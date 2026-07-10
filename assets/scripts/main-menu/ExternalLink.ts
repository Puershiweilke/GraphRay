import { _decorator, Component, Node, EventTouch, sys } from 'cc';
import { PlatformDetector, Platform } from '../core/PlatformDetector';
const { ccclass, property } = _decorator;

/**
 * ExternalLink - 点击节点后跳转外部 URL
 * 挂在 FooterLink 节点上，填入 url 即可。
 *
 * 各平台跳转方式：
 *   Web     → window.open 新标签页
 *   Wechat  → wx.openUrl (微信小游戏 API)
 *   Douyin  → tt.openSchema (抖音小游戏 API)
 *   Desktop → sys.openURL (调用系统默认浏览器)
 */
@ccclass('ExternalLink')
export class ExternalLink extends Component {

    @property({ tooltip: '要跳转的完整URL，例如 https://zzyhub.cn' })
    url: string = 'https://zzyhub.cn';

    protected onLoad(): void {
        this.node.on(Node.EventType.TOUCH_END, this._onTap, this);
    }

    protected onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_END, this._onTap, this);
    }

    private _onTap(_evt: EventTouch): void {
        if (!this.url) return;

        const g: any = globalThis;

        switch (PlatformDetector.detect()) {
            case Platform.Wechat:
                // 微信小游戏：需要把 http 转成云托管或业务域名，或者用客服消息等迂回方式
                // 直接跳转 Web 需 wx 配置业务域名
                g.wx?.openUrl?.({ url: this.url });
                break;

            case Platform.Douyin:
                // 抖音小游戏：用 openSchema 打开外链
                g.tt?.openSchema?.({
                    schema: this.url,
                    success: () => {},
                    fail: (err: any) => console.warn('[ExternalLink] tt.openSchema 失败', err),
                });
                break;

            case Platform.Desktop:
            case Platform.Web:
            default:
                // Web / 原生桌面：直接用 Cocos 内置方法
                sys.openURL(this.url);
                break;
        }
    }
}
