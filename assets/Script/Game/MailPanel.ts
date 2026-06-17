/**
 * 邮件面板
 */
import { _decorator, Button, Component, Label, Node } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';

const { ccclass, property } = _decorator;

type MailRow = {
    mail_id: string;
    title: string;
    body?: string;
    read?: boolean;
    claimed?: boolean;
};

@ccclass('MailPanel')
export class MailPanel extends Component {
    @property(Node)
    listRoot: Node | null = null;

    @property(Label)
    detailLabel: Label | null = null;

    @property(Button)
    claimButton: Button | null = null;

    @property(Button)
    refreshButton: Button | null = null;

    private _ws: WebSocketManager | null = null;
    private _mails: MailRow[] = [];
    private _selectedId: string | null = null;

    onLoad() {
        this._ws = WebSocketManager.getInstance();
        this.claimButton?.node.on(Button.EventType.CLICK, this.onClaim, this);
        this.refreshButton?.node.on(Button.EventType.CLICK, this.refreshList, this);
    }

    onEnable() {
        this.refreshList();
    }

    private refreshList = () => {
        if (!this._ws) return;
        this._ws.request('mail_list', {}, (resp: any) => {
            if (!resp?.success) return;
            this._mails = resp.data?.mails || resp.mails || [];
            this.renderList();
        }, true, 8000);
    };

    private renderList() {
        if (!this.listRoot) return;
        const children = this.listRoot.children;
        for (let i = 0; i < Math.max(children.length, this._mails.length); i++) {
            const row = children[i];
            const mail = this._mails[i];
            if (!row) continue;
            if (!mail) {
                row.active = false;
                continue;
            }
            row.active = true;
            const lab = row.getComponentInChildren(Label);
            if (lab) lab.string = `${mail.read ? '' : '[新]'}${mail.title}`;
            const btn = row.getComponent(Button);
            if (btn) {
                btn.node.off(Button.EventType.CLICK);
                btn.node.on(Button.EventType.CLICK, () => this.selectMail(mail.mail_id), this);
            }
        }
        if (this._mails.length && !this._selectedId) {
            this.selectMail(this._mails[0].mail_id);
        }
    }

    private selectMail(mailId: string) {
        this._selectedId = mailId;
        const mail = this._mails.find((m) => m.mail_id === mailId);
        if (!mail) return;
        if (this.detailLabel) {
            this.detailLabel.string = `${mail.title}\n\n${mail.body || ''}`;
        }
        this._ws?.request('mail_read', { mail_id: mailId }, () => {}, true, 5000);
        if (this.claimButton) {
            this.claimButton.interactable = !mail.claimed;
        }
    }

    private onClaim = () => {
        if (!this._ws || !this._selectedId) return;
        this._ws.request('mail_claim', { mail_id: this._selectedId }, (resp: any) => {
            if (resp?.success) {
                this.refreshList();
            }
        }, true, 8000);
    };
}
