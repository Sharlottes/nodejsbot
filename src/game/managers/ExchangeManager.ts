import { MessageSelectMenu, MessageSelectOptionData } from 'discord.js';

import { ItemStack, ItemStorable, UnitEntity, User, getOne } from '@RTTRPG/game';
import SelectManager from '@RTTRPG/game/managers/SelectManager';
import { Item, Items, Units } from '@RTTRPG/game/contents';
import { bundle } from '@RTTRPG/assets';
import ItemSelectManager from './ItemSelectManager';
import { EntityI, ManagerConstructOptions } from '@RTTRPG/@type';
import Manager from './Manager';

export default class ExchangeManager extends SelectManager {
	private readonly target: UnitEntity;
	private readonly user: User;
	private buyPage = 0;
	private sellPage = 0;

	public constructor(options: ManagerConstructOptions & { user: User, target: UnitEntity,  last?: SelectManager }) {
		super(options);
		this.target = options.target;
		this.user = options.user;
	}
	
	public override init() {
	  //고블린 인벤토리 생성
		for (let i = 0; i < 20; i++) {
			const item = getOne(Items.items.filter((i) => i.dropOnShop && i.id !== 5 && (typeof i)));
			const exist = this.target.inventory.items.find<ItemStack>((store): store is ItemStack => store instanceof ItemStack && store.item == item);
			if (exist) exist.amount++;
			else this.target.inventory.items.push(new ItemStack(item));
	
		}
		
	  this.addButtonSelection('back', 0, () => {
			this.addContentBlock(bundle.find(this.locale, 'shop.end'));
			this.setComponents([]);
			this.addRemoveButton();
			this.send();
		});

		this.addMenuSelection({
			customId: 'buy', 
			row: 1, 
			callback: async (interaction) => {
			if (!interaction.isSelectMenu()) return;
			const id = interaction.values[0];

			switch(id) {
				case '-1': {
					if(this.buyPage == 0) Manager.newErrorEmbed(this.interaction, bundle.find(this.locale, "error.first_page"));
					else this.buyPage--;
					break;
				}
				case '-2': {
					if(this.buyPage+1 > Math.floor(this.target.inventory.items.length/8)) Manager.newErrorEmbed(this.interaction, bundle.find(this.locale, "error.last_page"));
					else this.buyPage++;
					break;
				}
				default: {
					const store = this.target.inventory.items[Number(id)];
					
					if(store instanceof ItemStack && store.amount > 1) {
						ItemSelectManager.start<typeof ItemSelectManager>({ user: this.user, interaction: this.interaction, item: store, callback: async amount => {
							await this.deal(this.target, this.user, store, amount);

							(interaction.component as MessageSelectMenu).setOptions(this.target.inventory.items.reduce<MessageSelectOptionData[]>((a, store, index) => {
								if(index < this.buyPage * 8 || index > (this.buyPage + 1) * 8) return a;
								else return [...a, {
									label: store.item.localName(this.locale)+` ${(store instanceof ItemStack ? store.amount : 1)} ${bundle.find(this.locale, "unit.item")}, ${this.calPrice(store.item)} ${bundle.find(this.locale, "unit.money")}`,
									value: index.toString()
								}]
							}, [{label: bundle.find(this.locale, 'prev'), value: '-1'}]).concat({label: bundle.find(this.locale, 'next'), value: '-2'}));
								await this.updateEmbed();
								await this.send();
							}
						});
					} else {
						await this.deal(this.target, this.user, store, 1);
					}	
				}
			}

			(interaction.component as MessageSelectMenu).setOptions(this.target.inventory.items.reduce<MessageSelectOptionData[]>((a, store, index) => {
				if(index < this.buyPage * 8 || index > (this.buyPage + 1) * 8) return a;
				else return [...a, {
					label: store.item.localName(this.locale)+` ${(store instanceof ItemStack ? store.amount : 1)} ${bundle.find(this.locale, "unit.item")}, ${this.calPrice(store.item)} ${bundle.find(this.locale, "unit.money")}`,
					value: index.toString()
				}]
			}, [{label: bundle.find(this.locale, 'prev'), value: '-1'}]).concat({label: bundle.find(this.locale, 'next'), value: '-2'}));
			await this.updateEmbed();
			await this.send();
		},
		reducer: (store, index) => ({
			label: store.item.localName(this.locale)+` ${(store instanceof ItemStack ? store.amount : 1)} ${bundle.find(this.locale, "unit.item")}, ${this.calPrice(store.item)} ${bundle.find(this.locale, "unit.money")}`,
			value: index.toString()
		}),
		list: this.target.inventory.items,
		placeholder: 'select item to buy ...'
	});
		
		this.addMenuSelection({
			customId: 'sell', 
			row: 2, 
			callback: async (interaction) => {
			if (!interaction.isSelectMenu()) return;
			const id = interaction.values[0];
			switch(id) {
				case '-1': {
					if(this.sellPage == 0) Manager.newErrorEmbed(this.interaction, bundle.find(this.locale, "error.first_page"));
					else this.sellPage--;
					break;
				}
				case '-2': {
					if(this.sellPage+1 > Math.floor(this.user.inventory.items.length/8)) Manager.newErrorEmbed(this.interaction, bundle.find(this.locale, "error.last_page"));
					else this.sellPage++;
					break;
				}
				default: {
					const store = this.user.inventory.items[Number(id)];
					if(store instanceof ItemStack && store.amount > 1) {
						ItemSelectManager.start<typeof ItemSelectManager>({ 
							user: this.user, 
							interaction: this.interaction, 
							item: store, 
							callback: async amount => {
								await this.deal(this.user, this.target, store, amount);
								
								(interaction.component as MessageSelectMenu).setOptions(this.user.inventory.items.reduce<MessageSelectOptionData[]>((a, store, index)=>{
									if(index < this.sellPage * 8 || index > (this.sellPage + 1) * 8) return a;
									else return [...a, {
										label: store.item.localName(this.locale)+` ${(store instanceof ItemStack ? store.amount : 1)} ${bundle.find(this.locale, "unit.item")}, ${this.calPrice(store.item)} ${bundle.find(this.locale, "unit.money")}`,
										value: index.toString()
									}]
								}, [{label: bundle.find(this.locale, 'prev'), value: '-1'}]).concat({label: bundle.find(this.locale, 'next'), value: '-2'}));
								await this.updateEmbed();
								await this.send();
							}
						});
					} else {
						await this.deal(this.user, this.target, store, 1);
					}
				}
			}
			(interaction.component as MessageSelectMenu).setOptions(this.user.inventory.items.reduce<MessageSelectOptionData[]>((a, store, index)=>{
				if(index < this.sellPage * 8 || index > (this.sellPage + 1) * 8) return a;
				else return [...a, {
					label: store.item.localName(this.locale)+` ${(store instanceof ItemStack ? store.amount : 1)} ${bundle.find(this.locale, "unit.item")}, ${this.calPrice(store.item)} ${bundle.find(this.locale, "unit.money")}`,
					value: index.toString()
				}]
			}, [{label: bundle.find(this.locale, 'prev'), value: '-1'}]).concat({label: bundle.find(this.locale, 'next'), value: '-2'}));
			await this.updateEmbed();
			await this.send();
		},
		reducer: (store, index) => ({
			label: store.item.localName(this.locale)+` ${(store instanceof ItemStack ? store.amount : 1)} ${bundle.find(this.locale, "unit.item")}, ${this.calPrice(store.item)} ${bundle.find(this.locale, "unit.money")}`,
			value: index.toString()
		}),
		list: this.user.inventory.items,
		placeholder: 'select item to sell ...'
	});

		this.embeds[0].setFields([
			{ name: this.user.user.username, value: this.user.money + bundle.find(this.locale, 'unit.money'), inline: true },
			{ name: Units.find(this.target.id).localName(this.locale), value: this.target.money + bundle.find(this.locale, 'unit.money'), inline: true }
		]);
	}


	private calPrice(item: Item) {
		return Math.round((100 - item.ratio) * 3);
	}
	
	private async updateEmbed() {
		this.embeds[0].setFields([
			{	name: this.user.user.username, value: this.user.money + bundle.find(this.locale, 'unit.money'), inline: true },
			{	name: Units.find(this.target.id).localName(this.locale), value: this.target.money + bundle.find(this.locale, 'unit.money'), inline: true }
		]);
		await this.send();
	}

	private async deal<T extends ItemStorable>(owner: EntityI, visitor: EntityI, store: T, amount: number) {
		const max = store instanceof ItemStack ? store.amount : 1;
		const item = store.item;
		const money = this.calPrice(item);
    
		if (amount > max) { 
			this.addContentBlock('- '+bundle.format(this.locale, 'shop.notEnough_item', item.localName(this.locale), amount, max), 'diff'); 
		} 
		else if (visitor.money < amount * money) { 
			this.addContentBlock('- '+bundle.format(this.locale, 'shop.notEnough_money', amount * money, visitor.money), 'diff'); 
		} else {
			this.addContentBlock('+ '+bundle.format(this.locale, owner == this.user ? 'shop.sold' : 'shop.buyed', item.localName(this.locale), amount, owner.money, (owner.money + money * amount)), 'diff');

			visitor.money -= money * amount;
			visitor.inventory.add(item, amount);
			owner.money += money * amount;
			owner.inventory.remove(item, amount);
		}

		await this.updateEmbed();
	}
}