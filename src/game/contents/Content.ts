import { User } from '@뇌절봇/modules';
import { Utils } from '@뇌절봇/util';
import Assets from '@뇌절봇/assets';
import { giveItem, Rationess } from '@뇌절봇/game/rpg_';
import { Dropable, Consumable, Durable, Heathy } from '@뇌절봇/@type';

const Bundle = Assets.bundle;
let itemCount = 0;
let unitCount = 0;

export class Content {
	public readonly name: string;
	public readonly localName: (user?: User)=>string;
	public readonly description: (user?: User)=>string;
	public readonly details: (user?: User)=>string;

	constructor(name: string, type = 'other') {
		this.name = name;
		this.localName = (user?: User)=>Bundle.find(user?user.lang:'en', `content.${type}.${name}.name`);
		this.description = (user?: User)=>Bundle.find(user?user.lang:'en', `content.${type}.${name}.description`);
		this.details = (user?: User)=>Bundle.find(user?user.lang:'en', `content.${type}.${name}.details`);
	}
}

export class Item extends Content implements Dropable, Rationess {
	public readonly rare: number;
	public readonly cost: number;
	public readonly id: number;
	private dropOnWalk = true;
	private dropOnBattle = true;
	private dropOnShop = true;

	constructor(
		name: string,
		rare: number,
		cost: number
	) {
		super(name, 'item');
		this.rare = rare;
		this.cost = cost;
		this.id = itemCount++;
	}

	public dropableOnBattle() {
		return this.dropOnBattle;
	}
	public dropableOnWalking() {
		return this.dropOnWalk;
	}
	public dropableOnShop() {
		return this.dropOnShop;
	}

	public dropBattle(bool: boolean) {
		this.dropOnBattle = bool;
		return this;
	}
	public dropWalking(bool: boolean) {
		this.dropOnWalk = bool;
		return this;
	}
	public dropShop(bool: boolean) {
		this.dropOnShop = bool;
		return this;
	}

	public getRatio() {
		return this.rare;
	}
}

export class Buff {
	public readonly value: number;
	public readonly localName: (user: User)=>string;
	public readonly callback: (user: User, amount: number, buff: Buff) => string;

	constructor(
		value: number,
		name: string,
		callback: (user: User, amount: number, buff: Buff) => string
	) {
		this.value = value;
		
		this.localName = (user: User)=>Bundle.find(user.lang, `buff.${name}.name`);
		this.callback = callback;
	}

	public buff(user: User, amount: number) {
		return this.callback(user, amount, this);
	}
}

export class Potion extends Item implements Consumable, Rationess {
	private readonly buffes: Buff[];

	constructor(
		name: string,
		rare: number,
		cost: number,
		buffes: Buff[]
	) {
		super(name, rare, cost);
		this.buffes = buffes;
	}

	public consume(user: User, amount = 1) {
		return Bundle.format(user.lang, 'consume', this.localName(user), amount, this.buffes.map((b) => b.buff(user, amount)).join('\n  '));
	}

	public getRatio() {
		return this.rare;
	}
}

export class Weapon extends Item implements Durable {
	public readonly damage: number;
	public readonly cooldown: number;
	public readonly critical_ratio: number;
	public readonly critical_chance: number;
	public durability: number;

	constructor(
		name: string,
		rare: number,
		cost: number,
		damage: number,
		cooldown: number,
		critical_ratio: number,
		critical_chance: number,
		durability: number
	) {
		super(name, rare, cost);
		this.damage = damage;
		this.cooldown = cooldown;
		this.critical_chance = critical_chance;
		this.critical_ratio = critical_ratio;
		this.durability = durability;
	}

	getDurability(): number {
		return this.durability;
	}

	setDurability(durability: number): number {
		return this.durability = durability;
	}

	public attack(user: User, target: Heathy) {
		const critical = Utils.Mathf.randbool(this.critical_chance);

		return Bundle.format(user.lang, 'battle.hit',
			critical ? Bundle.find(user.lang, 'battle.critical') : '',
			this.localName(user),
			(this.damage + (critical ? this.critical_ratio * this.damage : 0)).toFixed(2),
			target.getHealth().toFixed(2),
			target.setHealth(target.getHealth() - this.damage + (critical ? this.critical_ratio * this.damage : 0)).toFixed(2),
			
		);
	}

	
	public attackEntity(user: User) {
		const critical = Utils.Mathf.randbool(this.critical_chance);

		return Bundle.format(user.lang, 'battle.entityHit',
			critical ? Bundle.find(user.lang, 'battle.critical') : '',
			this.localName(user),
			(this.damage + (critical ? this.critical_ratio * this.damage : 0)).toFixed(2),
			user.id,
			user.stats.health.toFixed(2),
			(user.stats.health -= this.damage + (critical ? this.critical_ratio * this.damage : 0)).toFixed(2),
		);
	}
}

export class Unit extends Content implements Heathy {
	public health: number;
	public healthRegen: number;
	public level: number;
	public rare: number;
	public readonly items: ItemStack[] = [];
	public id: number;

	constructor(
		name: string,
		health: number,
		healthRegen: number,
		level: number,
		rare: number,
		items: ItemStack[]
	) {
		super(name, 'unit');

		this.health = health;
		this.healthRegen = healthRegen;
		this.level = level;
		this.rare = rare;
		this.items = items;
		this.id = unitCount++;
	}
	getHealth(): number {
		return this.health;
	}
	setHealth(health: number): number {
		return this.health = health;
	}
	getMaxHealth(): number {
		return this.health;
	}
	setMaxHealth(max: number): number {
		return this.health = max;
	}
	getHealthRegen(): number {
		return this.healthRegen;
	}
	setHealthRegen(regen: number): number {
		return this.healthRegen = regen;
	}
}

export class ItemStack {
	id: number;
	amount: number;
	durability: number | undefined;

	constructor(id: number, amount=1, durability?: number) {
		this.id = id;
		this.amount = amount;
		this.durability = durability;
	}

	public static from(stack: ItemStack) {
		return new ItemStack(stack.id, stack.amount, stack.durability);
	}

	public static with(items: number[]) {
		const stacks: ItemStack[] = [];
		for (let i = 0; i < items.length; i += 2) {
			stacks[i / 2] = new ItemStack(items[i], items[i + 1]);
		}
		return stacks;
	}
	public static equals(stack: ItemStack, item: Item, amount?: number) {
		return stack.id == item.id && (!amount || stack.amount == amount);
	}

	public static consume(stack: ItemStack, user: User, amount = 1) {
		const item = Items.find(stack.id);
		if (item) {
			stack.amount--;
			if(stack.amount <= 0) user.inventory.items.splice(user.inventory.items.indexOf(stack), 1);
			return (item as unknown as Consumable).consume?.call(item, user, amount);
		}
	}

	public static getItem<T extends Item>(stack: ItemStack): T {
		return Items.find(stack.id) ;
	}
}

export class Items {
	private static readonly items: Item[] = [];

	public static init() {
		this.items.length = 0;
		itemCount = 0;
		this.items.push(new Weapon('stone', 0.3, 1.5, 1.15, 1.2, 0.2, 1.05, 1));
		this.items.push(new Item('fragment', 0.4, 0.5));
		this.items.push(new Potion('energy_bar', 0.2, 2, [
			new Buff(10, 'energy', (user: User, amount: number, buff: Buff) => {
				user.stats.energy += amount * buff.value;
				if(user.stats.energy > user.stats.energy_max) {
					user.stats.energy = user.stats.energy_max;
					giveItem(user, this.items[2], amount - Math.floor((user.stats.energy-user.stats.energy_max)/buff.value));
					
					return `* ${buff.localName(user)} +${amount * buff.value-(user.stats.energy-user.stats.energy_max)}`;
				}
				return `* ${buff.localName(user)} +${amount * buff.value}`;
			})
		]));
		this.items.push(new Weapon('aluminum_sword', 0.1, 15, 1.5, 1, 1.15, 0.25, 10).dropWalking(false).dropBattle(false));
		this.items.push(new Weapon('wooden_sword', 0.15, 10, 1.25, 1.5, 1.1, 0.15, 25).dropWalking(false).dropBattle(false));
		this.items.push(new Weapon('punch', -1, -1, 1, 1, 1.1, 0.1, -1).dropBattle(false).dropShop(false).dropWalking(false));
		this.items.push(new Potion('experience_bottle', 0.1, 2.5, [
			new Buff(10, 'exp', (user: User, amount: number, buff: Buff) => {
				user.exp += amount * buff.value;
				return `* ${buff.localName(user)} +${amount * buff.value}`;
			})
		]).dropWalking(false));
		this.items.push(new Potion('mochi-cookie', 0.15, 3.5, [
			new Buff(10, 'health', (user: User, amount: number, buff: Buff) => {
				user.stats.health += amount * buff.value;
				if(user.stats.health > user.stats.health_max) {
					user.stats.health = user.stats.health_max;
					giveItem(user, this.items[7], amount - Math.floor((user.stats.health-user.stats.health_max)/buff.value));
					
					return `* ${buff.localName(user)} +${amount * buff.value-(user.stats.health-user.stats.health_max)}`;
				}
				return `* ${buff.localName(user)} +${amount * buff.value}`;
			})
		]));
		this.items.push(new Item('cix_bottle', 0.05, 25));
	}
	public static getItems() {
		return this.items;
	}

	public static find<T extends Item>(id: number): T {
		return this.items[id] as T;
	}
}


export class Units {
	private static readonly units: Unit[] = [];

	public static init() {
		this.units.length = 0;
		unitCount = 0;
		this.units.push(new Unit('obstruction', 5, 0, 1, 0.1, []));
		this.units.push(new Unit('goblin', 2, 0, 1, 0.3, []));
	}

	public static getUnits() {
		return this.units;
	}

	public static find<T extends Unit>(id: number): T {
		return this.units[id] as T;
	}
}