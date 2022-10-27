import Discord, { Interaction, BaseInteraction, Message, EmbedBuilder, MessageOptions, CacheType, ActionRowBuilder, MessageComponentInteraction, ActionRowBuilderComponent } from 'discord.js';

import { StatusEntity, ItemStack, User, Inventory } from 'game';
import StatusEffect from 'game/contents/StatusEffect';
import Manager from 'game/managers/Manager';

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            DISCORD_TOKEN: string,
        }
    }
}

export type ComponentTrigger = (interaction: MessageComponentInteraction, manager: Manager) => void;
export type ManagerConstructOptions = {
    content?: string;
    embeds?: EmbedBuilder[];
    components?: ActionRowBuilder[];
    triggers?: Map<string, ComponentTrigger>;
    files?: Exclude<MessageOptions['files'], undefined>;
    interaction: BaseInteraction;
}
export type SelectManagerConstructOptions<L = SelectManager> = ManagerConstructOptions & { user: User, last?: L }

export interface Heathy {
    health: number
    health_max: number
}

export interface Energy {
    energy: number
    energy_max: number
}

export interface Durable {
    durability: number
}

export type Stat = {
    strength: number
    defense: number
} & Heathy & Energy;

export type Message = {
    interaction: Discord.CommandInteraction<CacheType>,
    sender: User
}

export type CommandInfo = {
    id: string
    application_id: string
    version: string
    default_permissions: null
    type: number
    name: string
    description: string
    guild_id: string
}

export type ContentData = {
    name: string
    description: string
    details: string
}

export interface Dropable {
    dropOnWalk?: boolean
    dropOnShop?: boolean
    dropOnBattle?: boolean
}

export interface Rationess {
    ratio: number
}

export type ItemData = Rationess & Dropable

export type UnitData = {
    name: string
    level: number
    inventory?: Inventory
    stats: Stat
} & Rationess

export type UserSave = {
    id: string
    money: number,
    level: number,
    exp: number,
    stats: Stat,
    inventory: InventoryJSONdata,
    fountContents: { items: number[], units: number[] }
}

export type InventoryJSONdata = {
    items: [{
        type: string,
        item: number,
        durability?: number,
        cooldown?: number,
        amount?: number,
        ammos?: number[]
    }],
    equipments: {
        weapon: {
            type: string,
            item: number,
            durability: number,
            cooldown: number,
            ammos?: number[]
        },
        shield: {
            type: string,
            item: number,
            durability: number
        }
    }
}

export type EventTrigger = (user: User, components: ActionRowBuilder[], interactionCallback: MessageComponentInteraction, currentRow: ActionRowBuilderComponent) => void;

export type EventSelection = {
    readonly name: string;
    readonly type: "button" | "select";
    readonly callback: EventTrigger;
    readonly options?: (InteractionButtonOptions | MessageSelectMenuOptions);
}

export type CommandCategory = "guild" | "global"

export interface EntityI extends StatusI {
    public readonly id: number | string;
    public readonly stats: Stat;
    public readonly inventory: Inventory;
    public readonly name: string | ((locale: string) => string);
    public exp: number;
    public level: number;
    public money: number;
    public switchWeapon: (weapon: Item) => void;
}

export interface StatusI {
    public readonly statuses: StatusEntity[] = [];
    public applyStatus: (status: StatusEffect) => void;
    public removeStatus: (status: StatusEffect) => void;
}