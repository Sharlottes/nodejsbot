import { bundle } from "@/assets";
import { User } from "@/game";
import { Content, Items, Units } from "@/game/contents";
import GameManager from "@/game/managers/GameManager";
import Manager from "@/game/managers/Manager";
import { Arrays } from "@/utils";
import { Pagination, PaginationType } from "@discordx/pagination";
import Discord from "discord.js";
import * as Discordx from "discordx";
import GeneralComponents, {
  CloseButtonComponent,
} from "../common/GeneralComponents";

@Discordx.Discord()
abstract class GameCommands {
  @Discordx.Slash({
    name: "start",
    description: "start the game",
  })
  async startGame(
    @Discordx.SlashOption({
      name: "target",
      description: "target channel to create game embeds",
      channelTypes: [Discord.ChannelType.PublicThread],
      type: Discord.ApplicationCommandOptionType.Channel,
      required: false,
    })
    channel: Discord.PublicThreadChannel | null,
    interaction: Discord.CommandInteraction
  ) {
    const user = User.findUserByInteraction(interaction);
    if (!user) return;

    if (user.gameManager) {
      Manager.newErrorEmbed(
        interaction,
        bundle.find(interaction.locale, "error.GMexist"),
        true
      );
      return;
    }

    if (!channel) {
      if (interaction.channel instanceof Discord.TextChannel)
        channel ??= (await interaction.channel.threads.create({
          name: `${user.name}'s playground`,
          type: Discord.ChannelType.PublicThread,
        })) as Discord.PublicThreadChannel;
      else throw new Error("interaction has no channel");
    }
    user.gameManager = new GameManager(user, channel, { interaction });
    await user.gameManager.update();
  }

  @Discordx.Slash({
    name: "info",
    description: "show content information",
  })
  async showContentInformation(
    @Discordx.SlashChoice(
      { name: "item", value: "item" },
      { name: "unit", value: "unit" }
    )
    @Discordx.SlashOption({
      name: "type",
      description: "the content type",
      type: Discord.ApplicationCommandOptionType.String,
      required: false,
    })
    type: "item" | "unit" | null,
    interaction: Discord.CommandInteraction
  ) {
    const user = User.findUserByInteraction(interaction);
    if (!user) return;

    const contents: Content[] = [];
    if (type === null || type == "unit") {
      for (const unit of Units.units) {
        if (!user.foundContents.units.includes(unit.id)) continue;
        contents.push(unit);
      }
    }

    if (type === null || type == "item") {
      for (const item of Items.items) {
        if (!user.foundContents.items.includes(item.id)) continue;
        contents.push(item);
      }
    }

    if (contents.length <= 0) {
      interaction.reply({
        embeds: [new Discord.EmbedBuilder().setDescription("< empty >")],
        components: [CloseButtonComponent.Row],
      });
    } else {
      const embeds: Discord.EmbedBuilder[] = [];
      Arrays.division(contents, 5).forEach((conts, i) => {
        const embed = new Discord.EmbedBuilder();
        embed.setTitle(`Page ${i + 1}`);
        conts.forEach((cont) =>
          embed.addFields({
            name: cont.localName(user),
            value: cont.description(user) + "\n\n" + (cont.details(user) || ""),
          })
        );
        embeds.push(embed);
      });
      new Pagination(
        interaction,
        embeds.map((embed) => ({ embeds: [embed] })),
        { ephemeral: true, type: PaginationType.Button }
      ).send();
    }
  }

  @Discordx.Slash({
    name: "intro",
    description: "introduce bot info",
  })
  showBotInformation(interaction: Discord.CommandInteraction) {
    interaction.reply({
      embeds: [
        new Discord.EmbedBuilder()
          .setTitle("Real Time Text RPG")
          .setDescription(bundle.find(interaction.locale, "bot.description"))
          .addFields({
            name: "GOAL",
            value: bundle.find(interaction.locale, "bot.goal"),
          }),
      ],
    });
  }
}
