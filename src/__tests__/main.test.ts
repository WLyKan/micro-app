/* eslint-disable promise/param-names, no-console */
import { commonStartEffect, releaseAllEffect, ports } from './common/initial'
import microApp, {
  preFetch,
  removeDomScope,
  version,
  pureCreateElement,
  EventCenterForMicroApp,
  getActiveApps,
  getAllApps,
} from '..'
import { appInstanceMap } from '../create_app'
import { getCurrentAppName, defer } from '../libs/utils'

describe('main process', () => {
  // 根容器
  let appCon: Element
  beforeAll(() => {
    commonStartEffect(ports.main)
    appCon = document.querySelector('#app-container')!
    console.log(version, pureCreateElement('div'))
    console.log(new EventCenterForMicroApp('app-name'))

    microApp.start({
      tagName: 'micro-app',
      // shadowDOM: true,
      // inline: true,
      // destroy: true,
      // disableScopecss: true,
      // disableSandbox: true,
      lifeCycles: {
        // created () {
        //   console.log('created 全局监听')
        // },
        // beforemount () {
        //   console.log('beforemount 全局监听')
        // },
        mounted () {
          // console.log('mounted 全局监听')
        },
        // unmount () {
        //   console.log('unmount 全局监听')
        // },
        // error () {
        //   console.log('error 全局监听')
        // }
      },
      plugins: {
        // global: [{
        //   scopeProperties: ['1', '2'],
        //   escapeProperties: ['a', 'b'],
        //   options: { a: 1 },
        //   loader (code, _url, _options) {
        //     console.log('全局插件', _url)
        //     return code
        //   }
        // }],
        modules: {
          test1: [{
            scopeProperties: ['3', '4'],
            escapeProperties: ['c', 'd'],
            loader (code, _url) {
              // console.log('test1插件', _url)
              return code
            }
          }],
          test2: [{
            scopeProperties: ['5', '6'],
            escapeProperties: ['e', 'f'],
            loader (code, _url) {
              // console.log('test2插件', _url)
              return code
            }
          }]
        }
      },
      preFetchApps: function () {
        return [
          {
            name: 'test-app5',
            url: `http://127.0.0.1:${ports.main}/ssr-render`,
            disableScopecss: true,
            disableSandbox: true,
          },
          {
            name: 'app-test-error',
            url: '',
          }
        ]
      },
      // globalAssets 测试分支覆盖
      globalAssets: 'xxx' as any,
    })

    preFetch([{
      name: 'test-app3',
      url: `http://127.0.0.1:${ports.main}/common`,
      // disableScopecss: xx,
      // disableSandbox: xx,
      shadowDOM: true,
    }])
  })

  afterAll(() => {
    return releaseAllEffect()
  })

  // 预加载的应用数量
  const prefetchAppNum = 2

  /**
   * name: test-app1
   * 预加载: false
   * 执行前: appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app3'},
   * ]
   */
  test('main process of micro-app', async () => {
    const microAppElement1 = document.createElement('micro-app')
    microAppElement1.setAttribute('name', 'test-app1')
    microAppElement1.setAttribute('url', `http://127.0.0.1:${ports.main}/common`)
    microAppElement1.setAttribute('inline', 'true')

    appCon.appendChild(microAppElement1)

    await new Promise((resolve) => {
      microAppElement1.addEventListener('mounted', () => {
        expect(appInstanceMap.size).toBe(prefetchAppNum + 1)
        expect(getActiveApps().length).toBe(1)
        expect(getAllApps().length).toBe(prefetchAppNum + 1)
        resolve(true)
      }, false)
    })

    await new Promise((resolve) => {
      microAppElement1.addEventListener('unmount', () => {
        defer(() => {
          expect(appInstanceMap.size).toBe(prefetchAppNum + 1)
          resolve(true)
        })
      }, false)

      appCon.removeChild(microAppElement1)
    })

    removeDomScope()
  })

  /**
   * name: test-app2
   * 预加载: false
   * 执行前: appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app3'},
   *  {name: 'test-app1'},
   * ]
   */
  test('app that stay active all the time', async () => {
    expect(getCurrentAppName()).toBeNull()
    const microAppElement2 = document.createElement('micro-app')
    microAppElement2.setAttribute('name', 'test-app2')
    microAppElement2.setAttribute('url', `http://127.0.0.1:${ports.main}/ssr-render`)

    appCon.appendChild(microAppElement2)

    await new Promise((resolve) => {
      microAppElement2.addEventListener('mounted', () => {
        expect(appInstanceMap.size).toBe(prefetchAppNum + 2)
        resolve(true)
      }, false)
    })
  })

  /**
   * name: test-app3
   * 预加载: true
   * 执行前: appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app3'},
   *  {name: 'test-app1'},
   *  {name: 'test-app2'},
   * ]
   */
  test('render an unstable app with special attribute', async () => {
    const microAppElement3 = document.createElement('micro-app')
    expect(microAppElement3.data).toBeNull()
    // @ts-ignore
    microAppElement3.setAttribute('data', { count: 'count-1' })
    expect(microAppElement3.data.count).toBe('count-1')
    microAppElement3.setAttribute('name', 'test-app3')
    microAppElement3.setAttribute('url', `http://127.0.0.1:${ports.main}/common`)
    microAppElement3.setAttribute('destroy', 'true')
    microAppElement3.setAttribute('shadowDOM', 'true')
    microAppElement3.setAttribute('inline', 'true')
    // @ts-ignore
    microAppElement3.setAttribute('data', { count: 'count-2' })
    expect(microAppElement3.data.count).toBe('count-2')
    let mountCount = 0

    appCon.appendChild(microAppElement3)

    await new Promise((resolve) => {
      microAppElement3.addEventListener('mounted', () => {
        const microElem = document.querySelectorAll('micro-app')[1]
        expect(microElem.shadowRoot instanceof ShadowRoot).toBeTruthy()

        mountCount++
        if (mountCount === 1) {
          expect(appInstanceMap.size).toBe(prefetchAppNum + 2)
          // 等懒加载资源执行完
          setTimeout(() => {
            microAppElement3.setAttribute('name', 'test-app1')
            microAppElement3.setAttribute('url', `http://127.0.0.1:${ports.main}/ssr-render`)
          }, 500)
        } else {
          // 预加载app test-app3，设置了destroy，name切换时被彻底删除
          expect(appInstanceMap.size).toBe(3)
          resolve(true)
        }
      }, false)
    })

    await new Promise((resolve) => {
      microAppElement3.addEventListener('unmount', () => {
        defer(() => {
          // test-app1也被删除
          expect(appInstanceMap.size).toBe(2)
          resolve(true)
        })
      }, false)

      appCon.removeChild(microAppElement3)
    })
  })

  /**
   * name: test-app4
   * 预加载: false
   * 执行前: appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app2'},
   * ]
   */
  test('failed to fetch html', async () => {
    const microAppElement4 = document.createElement('micro-app')
    microAppElement4.setAttribute('name', 'test-app4')
    microAppElement4.setAttribute('url', 'http://not-exist.com/xx')

    await new Promise((resolve) => {
      microAppElement4.addEventListener('error', () => {
        expect(console.error).toHaveBeenCalledWith('[micro-app] app test-app4: Failed to fetch data from http://not-exist.com/xx/, micro-app stop rendering', expect.any(Error))
        resolve(true)
      }, false)
      appCon.appendChild(microAppElement4)
    })
  })

  /**
   * name: test-app6
   * 预加载: false
   * 执行前: appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app2'},
   * ]
   *
   * 渲染umd应用，卸载时记录快照、重新渲染时恢复快照
   */
  test('mount and remount umd app ', async () => {
    const microAppElement6 = document.createElement('micro-app')
    microAppElement6.setAttribute('name', 'test-app6')
    microAppElement6.setAttribute('library', 'umd-app1') // 自定义umd名称
    microAppElement6.setAttribute('url', `http://127.0.0.1:${ports.main}/umd1`)

    let commonSolve: CallableFunction
    function firstMountHandler () {
      window.dispatchEvent(new CustomEvent('umd-window-event'))
      expect(console.warn).toHaveBeenCalledWith('umd-window-event is triggered')
      document.dispatchEvent(new CustomEvent('click'))
      expect(console.warn).toHaveBeenCalledWith('click event from umd init env')
      microAppElement6.removeEventListener('mounted', firstMountHandler)
      appCon.removeChild(microAppElement6)
      commonSolve(true)
    }

    microAppElement6.addEventListener('mounted', firstMountHandler)

    await new Promise((resolve) => {
      commonSolve = resolve
      appCon.appendChild(microAppElement6)
    })

    await new Promise((resolve) => {
      microAppElement6.addEventListener('mounted', () => {
        window.dispatchEvent(new CustomEvent('umd-window-event'))
        expect(console.warn).toHaveBeenCalledWith('umd-window-event is triggered')
        document.dispatchEvent(new CustomEvent('click'))
        expect(console.warn).toHaveBeenCalledWith('click event from umd init env')
        resolve(true)
      })
      // 再次渲染
      appCon.appendChild(microAppElement6)
    })
  })

  /**
   * name: test-app7
   * 预加载: false
   * 执行前: appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app2'},
   *  {name: 'test-app6'},
   * ]
   *
   * 关闭沙箱后，micro-app只渲染umd app，快照功能失效
   */
  test('render umd app with disableSandbox', async () => {
    const microAppElement7 = document.createElement('micro-app')
    microAppElement7.setAttribute('name', 'test-app7')
    microAppElement7.setAttribute('library', 'umd-app1') // 自定义umd名称
    microAppElement7.setAttribute('url', `http://127.0.0.1:${ports.main}/umd1`)
    microAppElement7.setAttribute('disableSandbox', 'true')

    let commonSolve: CallableFunction
    function firstMountHandler () {
      window.dispatchEvent(new CustomEvent('umd-window-event'))
      expect(console.warn).toHaveBeenCalledWith('umd-window-event is triggered')
      microAppElement7.removeEventListener('mounted', firstMountHandler)
      appCon.removeChild(microAppElement7)
      commonSolve(true)
    }

    microAppElement7.addEventListener('mounted', firstMountHandler)

    await new Promise((resolve) => {
      commonSolve = resolve
      appCon.appendChild(microAppElement7)
    })

    await new Promise((resolve) => {
      microAppElement7.addEventListener('mounted', () => {
        window.dispatchEvent(new CustomEvent('umd-window-event'))
        expect(console.warn).toHaveBeenCalledWith('umd-window-event is triggered')
        resolve(true)
      })
      // 再次渲染
      appCon.appendChild(microAppElement7)
    })
  })

  /**
   * 卸载所有应用
   * 卸载前：appInstanceMap => [
   *  {name: 'test-app5'},
   *  {name: 'test-app2'},
   *  {name: 'test-app6'},
   *  {name: 'test-app7'},
   * ]
   */
  test('clear all apps', () => {
    appCon.innerHTML = ''
    // test-app5为预加载，test-app2不强制删除，所以卸载后还有2个应用
    expect(appInstanceMap.size).toBe(4)
  })
})
