import { BaseEmbed, User } from '../modules';
import { Mathf, Canvas} from '../util';
import { UnitEntity, Items, Units } from '.';
import { Item, ItemStack, Weapon } from './contents';
import { bundle } from '../assets';
import { EventSelection, SelectEvent } from '../event';

import { getOne, save, findMessage } from './rpg_';

export default class BattleManager {
	target: UnitEntity;
  builder: BaseEmbed;
	interval: NodeJS.Timeout;
	battleLog: string[] = [];
	locale: string;

	constructor(user: User, target: UnitEntity) {
		this.target = target;
		this.locale = user.getLocale();
		this.builder = findMessage(user).builder as BaseEmbed;

		const data = SelectEvent.toActionData(this.selection, user);
		this.builder
			.setDescription(bundle.format(this.locale, 'battle.start', user.user.username, Units.find(this.target.id).localName(user)))
			.setComponents(data.actions)
			.setTriggers(data.triggers);


		this.interval = setInterval(() => {
			const inventory = this.target.inventory;
			const weapon: Weapon = Items.find(inventory.weapon.id);
			if(inventory.weapon.items[0]?.cooldown) inventory.weapon.items[0].cooldown -= 100 / 1000;
			if (inventory.weapon.items[0]?.cooldown && inventory.weapon.items[0].cooldown <= 0 && this.target.stats.health > 0) {
				inventory.weapon.items[0].cooldown = weapon.cooldown;

				// 내구도 감소, 만약 내구도가 없으면 주먹으로 교체.
				if(inventory.weapon.items[0]?.durability) {
					if(inventory.weapon.items[0].durability > 0) inventory.weapon.items[0].durability--;
					if(inventory.weapon.items[0].durability <= 0) {
						const punch = Items.find<Weapon>(5);
						this.updateEmbed(user, '- '+bundle.format(this.locale, 'battle.broken', weapon.localName(user)));
						inventory.weapon = new ItemStack(punch.id);
					}
				}

				//임베드 전투로그 업데이트
				this.updateEmbed(user, '- '+weapon.attack(user));
				this.builder.rerender().catch(e=>e);
				if (user.stats.health <= 0 || this.target.stats.health <= 0) this.battleEnd(user);
			}
		}, 100);
	}
  selection: EventSelection[][] = [
		[
			new EventSelection('attack', (user) => {
				if(user.stats.health <= 0 || this.target.stats.health <= 0) return;
				if (user.inventory.weapon.items[0]?.cooldown && user.inventory.weapon.items[0].cooldown > 0) {
					this.updateEmbed(user, '+ '+bundle.format(this.locale, 'battle.cooldown', user.inventory.weapon.items[0].cooldown.toFixed(2)));
					this.builder.rerender().catch(e=>e);
				} else {
					const weapon = user.inventory.weapon.getItem<Weapon>();

					// 내구도 감소, 만약 내구도가 없으면 주먹으로 교체.
					if(user.inventory.weapon.items[0]?.durability) {
						if(user.inventory.weapon.items[0].durability > 0) user.inventory.weapon.items[0].durability--;
						if(user.inventory.weapon.items[0].durability <= 0) {
							const punch = Items.find<Weapon>(5);
							this.updateEmbed(user, '+ '+bundle.format(this.locale, 'battle.broken', weapon.localName(user)));
							user.inventory.weapon = new ItemStack(punch.id);
						}
					}

					//임베드 전투로그 업데이트
					this.updateEmbed(user, '+ '+weapon.attack(user, this.target));
					this.builder.rerender().catch(e=>e);
					if (user.stats.health <= 0 || this.target.stats.health <= 0) this.battleEnd(user);
				}
			})
		],
		[
			new EventSelection('swap', (user, actions, interactionCallback) => {
				if (interactionCallback.isSelectMenu()) {
					const id = Number(interactionCallback.values[0]);
					const weapon: Weapon = Items.find(id);
					const entity = user.inventory.items.find((e) => e.id == id);
					if(!entity) return;
					
					entity.remove();
					if (!entity.amount) user.inventory.items.splice(user.inventory.items.indexOf(entity), 1);

					user.switchWeapon(weapon);
					this.updateEmbed(user, bundle.format(this.locale, 'switch_change', weapon.localName(user), user.inventory.weapon.getItem().localName(user)));
					this.builder.rerender().catch(e=>e);
				}
			}, 'select', u=>{
				const options = u.inventory.items.filter((e) => Items.find(e.id) instanceof Weapon).map((stack) => ({
					label: Items.find(stack.id)?.name,
					value: `${stack.id}`
				}));

				return {
					placeholder: 'swap weapon to ...',
					options: options.length > 0 ? options : [{label: Items.find(5).name, value: "5"}]
				};
			})
		]
	];

	updateEmbed(user: User, log: string) {
		if(this.battleLog.length > 5) this.battleLog.shift();
		this.battleLog.push(log);

		this.builder.setFields([
			{
				name: 'Battle Status',
				value: `You: ${Canvas.unicodeProgressBar(user.stats.health, user.stats.health_max)}\nEnemy: ${Canvas.unicodeProgressBar(this.target.stats.health, this.target.stats.health_max)}`
			},
			{
				name: 'Logs', 
				value: "```diff\n"+this.battleLog.join('```\n```diff\n')+"```"
			}
		]);
	}

	battleEnd(user: User) {
		clearInterval(this.interval);
		user.status.clearSelection();
		this.builder.setComponents([]);

		if(this.target.stats.health <= 0) {
			const unit = Units.find(this.target.id);
			const items: { item: Item, amount: number }[] = [];

			//전투 보상은 최소 1개, 최대 적 레벨의 4배만큼의 랜덤한 아이템
			for (let i = 0; i < Math.floor(Mathf.range(unit.level, unit.level * 4)) + 1; i++) {
				const item = getOne(Items.items.filter((i) => i.dropOnBattle));
				const obj = items.find((i) => i.item == item);
				if (obj) obj.amount++;
				else items.push({ item, amount: 1 });
			}

			//임베드에 전투 결과 메시지 추가
			this.updateEmbed(user, '+ '+(this.target.stats.health < 0 ? bundle.find(this.locale, 'battle.overkill')+' ' : '')+bundle.format(this.locale, 'battle.win', this.target.stats.health.toFixed(2)));
			this.builder.addFields(
				{
					name: 'Battle End', 
					value: 
					"```ini\n["
						+bundle.format(this.locale, 'battle.result', user.exp, user.exp += unit.level * (1 + unit.ratio) * 10, items.map((i) => `${i.item.localName(user)} +${i.amount} ${bundle.find(this.locale, 'unit.item')}`).join('\n'))
						+'\n'+items.map((i) => user.giveItem(i.item)).filter((e) => e).join('\n')
					+"]\n```"
				}
			);
		}
		else if(user.stats.health <= 0) {
			this.updateEmbed(user, '- '+bundle.format(this.locale, 'battle.lose', user.stats.health.toFixed(2)));
		}
		this.builder.rerender().catch(e=>e);
		save();
	}
}