import { codeBlock } from "@discordjs/builders";
import { ItemStack } from "@/game/Inventory";
import bundle from "@/assets/Bundle";
import User from "@/game/User";

import Manager, { ManagerConstructOptions } from "./Manager";

class PickupManager extends Manager {
  public stack?: ItemStack | undefined;
  public money?: number | undefined;
  private readonly user: User;

  public constructor(
    options: ManagerConstructOptions & {
      stack?: ItemStack;
      money?: number;
      user: User;
    },
  ) {
    super(options);

    this.user = options.user;
    this.stack = options.stack;
    this.money = options.money;

    this.user.money += this.money ?? 0;
    if (this.stack) this.user.giveItem(this.stack.item, this.stack.amount);

    this.setContent(
      codeBlock(
        bundle.format(
          this.locale,
          "event.pickup",
          this.stack ? this.stack.item.localName(this.locale) : this.money + bundle.find(this.locale, "unit.money"),
          this.stack
            ? `${this.stack.item.localName(this.locale)}: +${this.stack.amount}${bundle.find(this.locale, "unit.item")}`
            : `+${this.money}${bundle.find(this.locale, "unit.money")}`,
        ),
      ),
    ).addRemoveButton();
  }
}

export default PickupManager;
