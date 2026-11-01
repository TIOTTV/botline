const {
  Client,
  GatewayIntentBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.log("Ajoute le secret DISCORD_TOKEN, puis relance.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function menu() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("open-salon").setLabel("Créer un salon").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("reply").setLabel("Me répondre").setStyle(ButtonStyle.Secondary),
  );
}

function closeRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("close-salon").setLabel("Fermer ce salon").setStyle(ButtonStyle.Danger),
  );
}

function salonName(raw) {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const base = cleaned || "nouveau";
  return base.startsWith("salon-") ? base : `salon-${base}`;
}

client.once(Events.ClientReady, (ready) => {
  console.log(`En ligne : ${ready.user.tag}`);
  console.log(
    `Inviter : https://discord.com/oauth2/authorize?client_id=${ready.user.id}&permissions=68624&scope=bot`,
  );
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  const text = message.content.trim();
  const mentioned = message.mentions.has(client.user);
  if (text.startsWith("!salon")) {
    try {
      const channel = await message.guild.channels.create({
        name: salonName(text.slice(6)),
        type: ChannelType.GuildText,
      });
      await channel.send({
        content: `${message.author}, le salon est ouvert. Écris ici.`,
        components: [closeRow()],
      });
      await message.reply({ content: `Salon créé : ${channel}`, components: [menu()] });
    } catch {
      await message.reply("Je n'ai pas le droit de créer un salon. Réinvite le bot avec le lien de la console.");
    }
    return;
  }
  if (mentioned || text === "!menu" || text.startsWith("!menu") || text.startsWith("!aide")) {
    await message.reply({ content: `Oui ${message.author.username}.`, components: [menu()] });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId === "open-salon") {
      const modal = new ModalBuilder().setCustomId("salon-modal").setTitle("Nouveau salon");
      const input = new TextInputBuilder()
        .setCustomId("nom")
        .setLabel("Nom du salon")
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(80)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }
    if (interaction.isButton() && interaction.customId === "reply") {
      await interaction.reply({
        content: `Je te réponds, ${interaction.user.username}.`,
        components: [menu()],
      });
      return;
    }
    if (interaction.isButton() && interaction.customId === "close-salon") {
      const channel = interaction.channel;
      if (!channel || channel.isDMBased() || !("name" in channel) || !channel.name?.startsWith("salon-")) {
        await interaction.reply({ content: "Je ne ferme que les salons que j'ai créés.", ephemeral: true });
        return;
      }
      await interaction.reply({ content: "Je ferme ce salon.", ephemeral: true });
      await channel.delete().catch(() => undefined);
      return;
    }
    if (interaction.isModalSubmit() && interaction.customId === "salon-modal") {
      if (!interaction.guild) {
        await interaction.reply({ content: "Seulement sur un serveur.", ephemeral: true });
        return;
      }
      const channel = await interaction.guild.channels.create({
        name: salonName(interaction.fields.getTextInputValue("nom")),
        type: ChannelType.GuildText,
      });
      await channel.send({
        content: `${interaction.user}, le salon est ouvert. Écris ici.`,
        components: [closeRow()],
      });
      await interaction.reply({ content: `Salon créé : ${channel}`, components: [menu()] });
    }
  } catch {
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: "Je n'ai pas pu le faire. Vérifie que le bot peut gérer les salons.", ephemeral: true })
        .catch(() => undefined);
    }
  }
});

client.login(token);
