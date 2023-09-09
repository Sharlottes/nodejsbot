import { WeaponEntity, ItemStorable, ItemStack, SlotWeaponEntity } from "@/game/Inventory";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import Strings, { ANSIStyle } from "@/utils/Strings";
import { codeBlock } from "@discordjs/builders";
import Item from "@/game/contents/types/Item";
import { getOne } from "@/utils/functions";
import UnitEntity from "@/game/UnitEntity";
import Items from "@/game/contents/Items";
import { EntityI } from "@/@type/types";
import bundle from "@/assets/Bundle";
import Canvas from "@/utils/Canvas";
import Mathf from "@/utils/Mathf";
import User from "@/game/User";

import Manager, { ManagerConstructOptions } from "../Manager";
import { ConsumeAction } from "../actions/ConsumeAction";
import { AttackAction } from "../actions/AttackAction";
import { ReloadAction } from "../actions/ReloadAction";
import { ShieldAction } from "../actions/ShieldAction";
import ItemSelectManager from "../ItemSelectManager";
import { DvaseAction } from "../actions/DvaseAction";
import { EvaseAction } from "../actions/EvaseAction";
import { BaseAction } from "../actions/BaseAction";
import { SwapAction } from "../actions/SwapAction";
import ParentManager from "../ParentManager";
import ActionManager from "./ActionManager";

enum Status {
  DEFAULT,
  EVASION,
  SHIELD,
}

export default class BattleManager extends ParentManager {
  private readonly mainEmbed: EmbedBuilder;
  private readonly status: Map<EntityI, Status>;

  public readonly user: User;
  public readonly enemy: UnitEntity;
  public turn: EntityI; //normally, user first

  private totalTurn = 1;
  private evaseBtnSelected = false;

  private swapRefresher: () => this;
  private consumeRefresher: () => this;
  private reloadRefresher: () => this;

  public constructor(parentManager: Manager, options: ManagerConstructOptions & { enemy: UnitEntity; user: User }) {
    super(parentManager, options);
    this.user = this.turn = options.user;
    this.enemy = options.enemy;
    this.status = new Map<EntityI, Status>().set(options.user, Status.DEFAULT).set(this.enemy, Status.DEFAULT);

    this.mainEmbed = new EmbedBuilder().setTitle("Battle Status");

    this.setContent(
      bundle.format(this.locale, "battle.start", this.user.user.username, this.enemy.type.localName(this.user)),
    );
    this.setEmbeds(this.mainEmbed, ActionManager.actionEmbed);
    this.updateLog(bundle.format(this.locale, "battle.turnend", this.totalTurn));
    this.updateBar();

    this.addButtonSelection(
      "attack",
      0,
      async () => {
        const weapon = this.user.inventory.equipments.weapon;
        if (weapon.cooldown > 0) {
          Manager.newErrorEmbed(
            this.interaction,
            bundle.format(this.locale, "battle.cooldown", weapon.cooldown.toFixed()),
          );
        } else {
          await this.addAction(
            new AttackAction(this, this.user, this.enemy, this.user.inventory.equipments.weapon)
              .addListener("undo", () => (this.user.inventory.equipments.weapon.cooldown = 0))
              .addListener(
                "added",
                () =>
                  (this.user.inventory.equipments.weapon.cooldown =
                    this.user.inventory.equipments.weapon.item.getWeapon().cooldown),
              ),
          );
        }
      },
      { style: ButtonStyle.Primary },
    );

    this.addButtonSelection("evasion", 0, async () => {
      if (this.evaseBtnSelected) {
        this.evaseBtnSelected = false;
        this.addAction(
          new DvaseAction(this, this.user)
            .addListener("undo", () => (this.evaseBtnSelected = true))
            .addListener("runned", () => (this.evaseBtnSelected = false)),
        );
      } else {
        this.evaseBtnSelected = true;
        this.addAction(
          new EvaseAction(this, this.user)
            .addListener("undo", () => (this.evaseBtnSelected = false))
            .addListener("runned", () => (this.evaseBtnSelected = false)),
        );
      }
    });

    this.addButtonSelection("shield", 0, async () => this.addAction(new ShieldAction(this, this.user)));

    this.addButtonSelection("turn", 0, async () => {
      this.components[4].components[0].setDisabled(true);
      this.components.forEach((rows) => rows.components.forEach((component) => component.setDisabled(true)));
      await this.turnEnd();
    });

    this.swapRefresher = this.addMenuSelection(
      "swap",
      1,
      async (_, __, entity) => {
        if (!(entity instanceof WeaponEntity)) throw new Error("it's not weapon entity");

        new SwapAction(this, this.user, entity, true);
        this.updateBar();
        this.validate();
        await this.swapRefresher().update();
      },
      {
        placeholder: "swap weapon to ...",
        list: () =>
          (<ItemStorable[]>[new WeaponEntity(Items.punch)]).concat(
            this.user.inventory.items.filter((store) => store.item.hasWeapon()),
          ),
        reducer: (store, index) => ({
          label: `(${index + 1}) ${store.item.localName(this.locale)}, ${store.toStateString((key) =>
            bundle.find(this.locale, key),
          )}`,
          value: index.toString(),
        }),
      },
    );

    this.consumeRefresher = this.addMenuSelection(
      "consume",
      2,
      async (_, __, entity) => {
        if (entity instanceof ItemStack && entity.amount > 1) {
          new ItemSelectManager(this, {
            item: entity,
            interaction: this.interaction,
            callback: async (amount) => {
              await this.addAction(
                new ConsumeAction(this, this.user, entity.item, amount)
                  .addListener("added", () => this.consumeRefresher().update())
                  .addListener("undo", () => this.consumeRefresher().update()),
              );
              await this.consumeRefresher().update();
            },
          }).send();
        } else {
          await this.addAction(
            new ConsumeAction(this, this.user, entity.item, 1)
              .addListener("added", () => this.consumeRefresher().update())
              .addListener("undo", () => this.consumeRefresher().update()),
          );
        }
      },
      {
        placeholder: "consume ...",
        list: () => this.user.inventory.items.filter((store) => store.item.hasConsume()),
        reducer: (store, index) => ({
          label: `(${index + 1}) ${store.item.localName(this.locale)} ${store.toStateString((key) =>
            bundle.find(this.locale, key),
          )}`,
          value: index.toString(),
        }),
      },
    );

    this.reloadRefresher = this.addMenuSelection(
      "reload",
      3,
      async (_, __, entity) => {
        if (entity instanceof ItemStack && entity.amount > 1) {
          new ItemSelectManager(this, {
            item: entity,
            interaction: this.interaction,
            callback: async (amount) => {
              this.addAction(
                new ReloadAction(this, this.user, new ItemStack(entity.item, amount))
                  .addListener("added", () => this.reloadRefresher().update())
                  .addListener("undo", () => this.reloadRefresher().update()),
              );
              await this.reloadRefresher().update();
            },
          }).send();
        } else {
          await this.addAction(
            new ReloadAction(this, this.user, new ItemStack(entity.item, 1))
              .addListener("added", () => this.reloadRefresher().update())
              .addListener("undo", () => this.reloadRefresher().update()),
          );
        }
      },
      {
        placeholder: "reload ammo with ...",
        list: () => this.user.inventory.items.filter((store) => store.item.hasAmmo()),
        reducer: (store, index) => ({
          label: `(${index + 1}) ${store.item.localName(this.locale)} ${store.toStateString((key) =>
            bundle.find(this.locale, key),
          )}`,
          value: index.toString(),
        }),
      },
    );

    this.addButtonSelection(
      "undo",
      4,
      () => {
        ActionManager.undoAction();
        this.updateBar();
        this.validate();
        this.update();
      },
      {
        style: ButtonStyle.Danger,
        disabled: true,
      },
    );

    this.validate();
    this.update();
  }

  isEvasion = (owner: EntityI) => this.status.get(owner) === Status.EVASION;
  setEvasion = (owner: EntityI, evase: boolean) => this.status.set(owner, evase ? Status.EVASION : Status.DEFAULT);
  isShielded = (owner: EntityI) => this.status.get(owner) === Status.SHIELD;
  setShield = (owner: EntityI, evase: boolean) => this.status.set(owner, evase ? Status.SHIELD : Status.DEFAULT);

  getItsOpponent(owner: EntityI) {
    if (owner == this.user) return this.enemy;
    if (owner == this.enemy) return this.user;
  }

  /**
   * 모든 컴포넌트에 대해 유효성 검사를 합니다.
   */
  private validate() {
    //자신의 턴일때만 활성화
    this.components.forEach((row) =>
      row.components.forEach((component) => component.setDisabled(this.turn != this.user)),
    );
    if (this.turn != this.user) return;

    const [
      {
        components: [attack, evase, shield],
      },
      ,
      ,
      {
        components: [reload],
      },
      {
        components: [actionCancel],
      },
    ] = this.components;

    actionCancel.setDisabled(ActionManager.isEmpty());
    attack.setDisabled(this.user.inventory.equipments.weapon.cooldown > 0);
    shield.setDisabled(!this.user.inventory.equipments.shield);
    reload.setDisabled(!(this.user.inventory.equipments.weapon instanceof SlotWeaponEntity));

    //회피 on/off
    (evase as ButtonBuilder).setLabel(
      bundle.find(this.locale, this.evaseBtnSelected ? "select.dvasion" : "select.evasion"),
    );
  }

  private async addAction(action: BaseAction) {
    if (!action.bloody && this.turn.stats.energy_max !== 0 && this.turn.stats.energy < action.cost) {
      new Manager({
        interaction: this.interaction,
        embeds: [
          new EmbedBuilder()
            .setTitle("ALERT")
            .setDescription(bundle.format(this.locale, "error.low_energy", this.turn.stats.energy, action.cost)),
        ],
      })
        .addComponents(
          new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder()
              .setCustomId("useHealth")
              .setLabel(bundle.find(this.locale, "select.useHealth"))
              .setStyle(ButtonStyle.Secondary),
          ]),
        )
        .setTrigger("useHealth", (_, manager) => {
          manager.remove();
          action.enableBloody();
          this.addAction(action);
        })
        .addRemoveButton()
        .send();
      return;
    }

    /*
		TODO: action valid 함수 만들기
		if (this.status.get(this.user) !== Status.DEFAULT) {
			Manager.newErrorEmbed(this.interaction, bundle.find(this.locale, "error.action_status"));
			return;
		}
		*/
    ActionManager.addAction(action);
    this.updateBar();
    this.validate();
    await this.update();
  }

  private async turnEnd() {
    //쿨다운 감소
    for (const item of this.turn.inventory.items) {
      if (item.item.hasWeapon()) (item as WeaponEntity).cooldown = Math.max(0, (item as WeaponEntity).cooldown - 1);
    }
    this.turn.inventory.equipments.weapon.cooldown = Math.max(0, this.turn.inventory.equipments.weapon.cooldown - 1);

    //버프/디버프 효과
    for (const status of this.turn.statuses) {
      status.status.callback(this.turn, status);
      status.duration--;
      if (status.duration <= 0)
        this.turn.statuses.splice(
          this.turn.statuses.findIndex((s) => s == status),
          1,
        );
    }

    ActionManager.onTurnEnd(this);

    //둘 중 하나가 죽으면 전투 끝
    if (this.user.stats.health <= 0 || this.enemy.stats.health <= 0) {
      await this.battleEnd();
      return;
    }

    if (this.turn == this.user) {
      this.turn = this.enemy;
      this.status.set(this.enemy, Status.DEFAULT);
      if (this.enemy.inventory.equipments.weapon.item != Items.none)
        await this.addAction(new AttackAction(this, this.enemy, this.user, this.enemy.inventory.equipments.weapon));
      this.turnEnd();
      return;
    }
    this.totalTurn++;
    this.turn = this.user;
    this.status.set(this.user, Status.DEFAULT);

    this.updateBar();
    this.validate();
    this.updateLog(bundle.format(this.locale, "battle.turnend", this.totalTurn));
    this.consumeRefresher();
    this.reloadRefresher();
    this.swapRefresher();
    await this.update();
  }

  public updateLog(log: string): this {
    this.addContent(codeBlock("diff", log));
    return this;
  }

  public updateBar() {
    this.mainEmbed.setFields([
      {
        name:
          this.user.user.username +
          (this.turn == this.user ? `   ${this.totalTurn} ` + bundle.find(this.locale, "turn") : "") +
          (this.isEvasion(this.user) ? `   ${bundle.find(this.locale, "evasion")}` : ""),
        value:
          `**${bundle.find(this.locale, "health")}**: ${this.user.stats.health}/${
            this.user.stats.health_max
          }\n${Canvas.unicodeProgressBar(this.user.stats.health, this.user.stats.health_max)}` +
          `\n\n**${bundle.find(this.locale, "energy")}**: ${this.user.stats.energy}/${
            this.user.stats.energy_max
          }\n${Canvas.unicodeProgressBar(this.user.stats.energy, this.user.stats.energy_max)}` +
          `\n\n**${bundle.find(this.locale, "weapon")}**: ${this.user.inventory.equipments.weapon.item.localName(
            this.locale,
          )}(${this.user.inventory.equipments.weapon.cooldown}), ${bundle.find(this.locale, "durability")} ${
            this.user.inventory.equipments.weapon.durability ?? "0"
          }` +
          (this.user.inventory.equipments.weapon instanceof SlotWeaponEntity
            ? `, ${bundle.find(this.locale, "ammo")} ${
                this.user.inventory.equipments.weapon.ammos.length
              } ${bundle.find(this.locale, "unit.item")}`
            : "") +
          (this.user.inventory.equipments.shield
            ? `\n\n**${bundle.find(this.locale, "shield")}**: ${this.user.inventory.equipments.shield.item.localName(
                this.locale,
              )}, ${bundle.find(this.locale, "durability")} ${this.user.inventory.equipments.shield.durability}`
            : "") +
          (this.user.statuses.length > 0
            ? `\n**${bundle.find(this.locale, "status")}**\n${this.user.statuses
                .map(
                  (status) =>
                    `${status.status.localName(this.locale)}: ${status.duration.toFixed()} ${bundle.find(
                      this.locale,
                      "turn",
                    )}`,
                )
                .join("\n")}`
            : ""),
        inline: true,
      },
      {
        name:
          this.enemy.type.localName(this.locale) +
          (this.turn == this.enemy ? `   ${this.totalTurn} ` + bundle.find(this.locale, "turn") : "") +
          (this.isEvasion(this.enemy) ? `   ${bundle.find(this.locale, "evasion")}` : ""),
        value:
          `**${bundle.find(this.locale, "health")}**: ${this.enemy.stats.health}/${
            this.enemy.stats.health_max
          }\n${Canvas.unicodeProgressBar(this.enemy.stats.health, this.enemy.stats.health_max)}` +
          `\n\n**${bundle.find(this.locale, "energy")}**: ${this.enemy.stats.energy}/${
            this.enemy.stats.energy_max
          }\n${Canvas.unicodeProgressBar(this.enemy.stats.energy, this.enemy.stats.energy_max)}` +
          `\n\n**${bundle.find(this.locale, "weapon")}**: ${this.enemy.inventory.equipments.weapon.item.localName(
            this.locale,
          )}(${this.enemy.inventory.equipments.weapon.cooldown || 0}), ${bundle.find(this.locale, "durability")} ${
            this.enemy.inventory.equipments.weapon.durability ?? "0"
          }` +
          (this.enemy.inventory.equipments.weapon instanceof SlotWeaponEntity
            ? `, ${bundle.find(this.locale, "ammo")} ${
                this.enemy.inventory.equipments.weapon.ammos.length
              } ${bundle.find(this.locale, "unit.item")}`
            : "") +
          (this.enemy.inventory.equipments.shield
            ? `\n\n**${bundle.find(this.locale, "shield")}**: ${this.enemy.inventory.equipments.shield.item.localName(
                this.locale,
              )}, ${bundle.find(this.locale, "durability")} ${this.enemy.inventory.equipments.shield.durability}`
            : "") +
          (this.enemy.statuses.length > 0
            ? `\n**${bundle.find(this.locale, "status")}**\n${this.enemy.statuses
                .map(
                  (status) =>
                    `${status.status.localName(this.locale)}: ${status.duration.toFixed()} ${bundle.find(
                      this.locale,
                      "turn",
                    )}`,
                )
                .join("\n")}`
            : ""),
        inline: true,
      },
    ]);
  }

  private async battleEnd() {
    this.setEmbeds(this.mainEmbed);
    this.updateBar();
    if (this.enemy.stats.health <= 0) {
      const unit = this.enemy.type;
      const items: { item: Item; amount: number }[] = [];

      //전투 보상은 최소 1개, 최대 적 레벨의 4배만큼의 랜덤한 아이템
      for (let i = 0; i < Math.floor(Mathf.range(unit.level, unit.level * 4)) + 1; i++) {
        const item = getOne(Items.items.filter((i) => i.dropOnBattle));
        const obj = items.find((i) => i.item == item);
        if (obj) obj.amount++;
        else items.push({ item, amount: 1 });
      }

      this.updateLog(
        "+ " +
          (this.enemy.stats.health < 0 ? bundle.find(this.locale, "battle.overkill") + " " : "") +
          bundle.format(this.locale, "battle.win", this.enemy.stats.health),
      );
      this.mainEmbed.addFields({
        name: "Battle End",
        value: Strings.color(
          bundle.format(
            this.locale,
            "battle.result",
            this.user.exp,
            (this.user.exp += unit.level * (1 + unit.ratio) * 10),
            items
              .map((i) => `${i.item.localName(this.locale)} +${i.amount} ${bundle.find(this.locale, "unit.item")}`)
              .join("\n"),
          ) +
            "\n" +
            items
              .map((i) => this.user.giveItem(i.item))
              .filter((e) => e)
              .join("\n"),
          [ANSIStyle.BLUE],
        ),
      });
    } else if (this.user.stats.health <= 0) {
      this.updateLog("- " + bundle.format(this.locale, "battle.lose", this.user.stats.health));
      //TODO: 패배 부분 구현하기
    }
    this.endManager();
  }
}
