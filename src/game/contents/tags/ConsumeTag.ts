import { EntityI } from '@RTTRPG/@type';
import { ItemEntity } from '@RTTRPG/game/Inventory';
import { MessageEmbed } from 'discord.js';
import Buff from '../Buff';
import Item from '../Item';
import ItemTag from './ItemTag';

export default class ConsumeTag extends ItemTag {
  public readonly buffes: Buff[];
  public readonly name = "Consume";
  
  constructor(item: Item, buffes: Buff[]) {
    super(item);
    this.buffes = buffes;
  }
  
	public consume(owner: EntityI, amount = 1) {
		this.buffes.forEach((b) => b.buff(owner, amount));
	}

  //TODO: 버프 설명 구체화
  public buildInfo(embed: MessageEmbed, entity?: ItemEntity | undefined): MessageEmbed {
    return embed.addField('buffes', this.buffes.map<string>(buff => buff.localName('en-US')).join('\n'));
  }
}