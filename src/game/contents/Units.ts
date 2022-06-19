import { Items, Unit } from ".";
import { Inventory, WeaponEntity } from "@RTTRPG/game";

export default class Units {
	static readonly units: Unit[] = [];
	public static goblin: Unit;

	static init() {
		this.units.push(new Unit({
			name: 'obstruction',
			level: 1,
			stats: {
				strength: 0,
				defense: 0,
				health: 20,
				health_max: 20,
				energy: 200,
				energy_max: 100
			},
			ratio: 0.05,
			inventory: new Inventory().setWeapon(new WeaponEntity(Items.find(10)))
		}));
		this.units.push(this.goblin = new Unit({
			name: 'goblin',
			level: 1,
			stats: {
				strength: 0,
				defense: 0,
				health: 5,
				health_max: 5,
				energy: 100,
				energy_max: 100
			},
			ratio: 0.2,
			inventory: new Inventory()
		}));
	}

	static find<T extends Unit>(id: number): T {
		return this.units[id] as T;
	}
}