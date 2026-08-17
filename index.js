const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;

const PREFIX = ",";

if (!TOKEN) {
  console.log("❌ DISCORD_TOKEN is missing");
  process.exit(1);
}

/* =========================================================
   CLIENT
========================================================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.User
  ]
});

/* =========================================================
   DATABASE
========================================================= */

const DATA = path.join(__dirname, "data");

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA);

function file(name) {
  return path.join(DATA, name);
}

function load(name, fallback = {}) {
  const f = file(name);

  if (!fs.existsSync(f)) {
    fs.writeFileSync(f, JSON.stringify(fallback, null, 2));
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return fallback;
  }
}

function save(name, data) {
  fs.writeFileSync(file(name), JSON.stringify(data, null, 2));
}

const db = {
  guilds: load("guilds.json"),
  users: load("users.json"),
  warns: load("warns.json"),
  afk: load("afk.json"),
  custom: load("custom.json"),
  economy: load("economy.json"),
  levels: load("levels.json"),
  tickets: load("tickets.json"),
  giveaways: load("giveaways.json"),
  invites: load("invites.json"),
  reminders: load("reminders.json")
};

/* =========================================================
   DEFAULT CONFIG
========================================================= */

function guildConfig(id) {
  if (!db.guilds[id]) {
    db.guilds[id] = {
      prefix: ",",

      welcome: {
        enabled: false,
        channel: null,
        message: "Welcome {user} to {server}!"
      },

      goodbye: {
        enabled: false,
        channel: null,
        message: "{user} has left the server."
      },

      logs: {
        enabled: false,
        channel: null
      },

      modlogs: {
        enabled: false,
        channel: null
      },

      autorole: null,

      suggestions: {
        enabled: false,
        channel: null
      },

      starboard: {
        enabled: false,
        channel: null,
        threshold: 3
      },

      leveling: {
        enabled: false,
        channel: null,
        xpMin: 10,
        xpMax: 25
      },

      automod: {
        enabled: false,
        antiSpam: true,
        antiLinks: false,
        antiInvites: false,
        antiMentions: false
      },

      verification: {
        enabled: false,
        channel: null,
        role: null
      },

      tickets: {
        enabled: false,
        category: null
      },

      invites: {
        enabled: false
      },

      economy: {
        enabled: false
      }
    };

    save("guilds.json", db.guilds);
  }

  return db.guilds[id];
}

/* =========================================================
   HELPERS
========================================================= */

function isOwner(message) {
  return message.author.id === OWNER_ID;
}

function isAdmin(message) {
  return message.member?.permissions.has(
    PermissionsBitField.Flags.Administrator
  );
}

function isMod(message) {
  return message.member?.permissions.has(
    PermissionsBitField.Flags.ManageMessages
  ) ||
  message.member?.permissions.has(
    PermissionsBitField.Flags.ModerateMembers
  );
}

function argsText(args) {
  return args.join(" ").trim();
}

function mentionUser(message, arg) {
  return (
    message.mentions.members.first() ||
    message.guild.members.cache.get(arg)
  );
}

function success(text) {
  return `✅ ${text}`;
}

function error(text) {
  return `❌ ${text}`;
}

function money(id) {
  if (!db.economy[id]) {
    db.economy[id] = {
      balance: 0,
      bank: 0,
      lastDaily: 0,
      lastWork: 0
    };
  }

  return db.economy[id];
}

function levelUser(id) {
  if (!db.levels[id]) {
    db.levels[id] = {
      xp: 0,
      level: 1
    };
  }

  return db.levels[id];
}

function embed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description || "")
    .setTimestamp();
}

async function logAction(guild, text) {
  const config = guildConfig(guild.id);

  if (!config.logs.enabled || !config.logs.channel) return;

  const channel = guild.channels.cache.get(config.logs.channel);

  if (!channel) return;

  channel.send({
    embeds: [
      embed("📜 Server Log", text)
    ]
  }).catch(() => {});
}

async function modLog(guild, text) {
  const config = guildConfig(guild.id);

  if (!config.modlogs.enabled || !config.modlogs.channel) return;

  const channel = guild.channels.cache.get(config.modlogs.channel);

  if (!channel) return;

  channel.send({
    embeds: [
      embed("🛡️ Moderation Log", text)
    ]
  }).catch(() => {});
}

/* =========================================================
   COMMAND SYSTEM
========================================================= */

const commands = new Map();

function command(name, callback) {
  commands.set(name, callback);
}

/* =========================================================
   BASIC
========================================================= */

command("help", async (m) => {
  const e = new EmbedBuilder()
    .setTitle("🤖 Bot Commands")
    .setDescription(
`Prefix: \`,\`

**🛡️ Moderation**
\`,ban\` \`,unban\` \`,kick\` \`,warn\` \`,warnings\` \`,timeout\`
\`,untimeout\` \`,purge\` \`,slowmode\` \`,lock\` \`,unlock\`
\`,nick\` \`,role\` \`,removerole\`

**⚙️ Configuration**
\`,setup\` \`,config\` \`,setprefix\`

**💬 Messaging**
\`,say\` \`,dm\` \`,announce\` \`,embed\` \`,poll\` \`,quote\`

**🎫 Tickets**
\`,ticket\` \`,close\` \`,claim\` \`,add\` \`,remove\`

**🎁 Giveaways**
\`,giveaway\` \`,reroll\` \`,gend\`

**👤 Users**
\`,userinfo\` \`,avatar\` \`,banner\` \`,afk\`

**📈 Leveling**
\`,rank\` \`,level\` \`,leaderboard\`

**💰 Economy**
\`,balance\` \`,daily\` \`,work\` \`,pay\` \`,shop\`

**🔗 Invites**
\`,invites\` \`,inviteinfo\` \`,invitelb\`

**🎮 Fun**
\`,8ball\` \`,coinflip\` \`,dice\` \`,choose\` \`,rate\`
\`,compliment\` \`,roast\` \`,ship\`

**🧰 Utility**
\`,ping\` \`,serverinfo\` \`,botinfo\` \`,membercount\`
\`,remind\` \`,servericon\` \`,serverbanner\`

**👑 Owner**
\`,broadcast\` \`,servers\` \`,maintenance\` \`,status\`
`
    )
    .setFooter({
      text: "Public Discord Bot"
    });

  m.reply({ embeds: [e] });
});

command("ping", async (m) => {
  const msg = await m.reply("🏓 Checking...");

  msg.edit(
    `🏓 **Pong!**\nLatency: **${
      msg.createdTimestamp - m.createdTimestamp
    }ms**\nAPI: **${client.ws.ping}ms**`
  );
});

command("botinfo", async (m) => {
  const users = client.guilds.cache.reduce(
    (total, g) => total + g.memberCount,
    0
  );

  m.reply({
    embeds: [
      embed(
        "🤖 Bot Information",
        `**Servers:** ${client.guilds.cache.size}\n` +
        `**Users:** ${users}\n` +
        `**Commands:** ${commands.size}\n` +
        `**Uptime:** ${Math.floor(client.uptime / 1000)} seconds`
      )
    ]
  });
});

command("serverinfo", async (m) => {
  const g = m.guild;

  m.reply({
    embeds: [
      embed(
        "📊 Server Information",
        `**Name:** ${g.name}\n` +
        `**ID:** ${g.id}\n` +
        `**Owner:** <@${g.ownerId}>\n` +
        `**Members:** ${g.memberCount}\n` +
        `**Channels:** ${g.channels.cache.size}\n` +
        `**Roles:** ${g.roles.cache.size}`
      )
    ]
  });
});

command("membercount", async (m) => {
  m.reply(`👥 **${m.guild.memberCount}** members`);
});

/* =========================================================
   USER
========================================================= */

command("userinfo", async (m, args) => {
  const user =
    mentionUser(m, args[0]) ||
    m.member;

  m.reply({
    embeds: [
      embed(
        "👤 User Information",
        `**Username:** ${user.user.tag}\n` +
        `**ID:** ${user.id}\n` +
        `**Joined:** <t:${Math.floor(user.joinedTimestamp / 1000)}:R>\n` +
        `**Account:** <t:${Math.floor(user.user.createdTimestamp / 1000)}:R>`
      )
    ]
  });
});

command("avatar", async (m, args) => {
  const user =
    mentionUser(m, args[0]) ||
    m.member;

  m.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`${user.user.username}'s Avatar`)
        .setImage(user.user.displayAvatarURL({ size: 2048 }))
    ]
  });
});

command("banner", async (m, args) => {
  const user =
    m.mentions.users.first() ||
    m.author;

  const fetched = await client.users.fetch(user.id, {
    force: true
  });

  if (!fetched.banner) {
    return m.reply("❌ This user doesn't have a banner.");
  }

  m.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`${fetched.username}'s Banner`)
        .setImage(fetched.bannerURL({ size: 2048 }))
    ]
  });
});

command("servericon", async (m) => {
  if (!m.guild.icon) return m.reply("❌ No server icon.");

  m.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`${m.guild.name}'s Icon`)
        .setImage(m.guild.iconURL({ size: 2048 }))
    ]
  });
});

command("serverbanner", async (m) => {
  if (!m.guild.banner) return m.reply("❌ No server banner.");

  m.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`${m.guild.name}'s Banner`)
        .setImage(m.guild.bannerURL({ size: 2048 }))
    ]
  });
});

/* =========================================================
   MESSAGING
========================================================= */

command("say", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));
  if (!args.length) return m.reply("Usage: `,say <message>`");

  await m.delete().catch(() => {});
  m.channel.send(argsText(args));
});

command("dm", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  const target = mentionUser(m, args[0]);

  if (!target) return m.reply("Usage: `,dm @user <message>`");

  const text = args.slice(1).join(" ");

  if (!text) return m.reply("❌ Message required.");

  try {
    await target.send(text);
    m.reply(success("DM sent."));
  } catch {
    m.reply(error("I couldn't DM that user."));
  }
});

command("announce", async (m, args) => {
  if (!isAdmin(m)) return m.reply(error("Administrator required."));
  if (!args.length) return m.reply("Usage: `,announce <message>`");

  const e = new EmbedBuilder()
    .setTitle("📢 Announcement")
    .setDescription(argsText(args))
    .setFooter({
      text: `Announced by ${m.author.tag}`
    })
    .setTimestamp();

  m.channel.send({ embeds: [e] });
});

command("embed", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));
  if (!args.length) return m.reply("Usage: `,embed <message>`");

  m.channel.send({
    embeds: [
      embed("", argsText(args))
    ]
  });
});

command("poll", async (m, args) => {
  if (!args.length) return m.reply("Usage: `,poll <question>`");

  const msg = await m.channel.send({
    embeds: [
      embed("📊 Poll", argsText(args))
    ]
  });

  await msg.react("👍");
  await msg.react("👎");
});

/* =========================================================
   MODERATION
========================================================= */

command("ban", async (m, args) => {
  if (!m.member.permissions.has(PermissionsBitField.Flags.BanMembers))
    return m.reply(error("Ban Members permission required."));

  const target = mentionUser(m, args[0]);

  if (!target) return m.reply("Usage: `,ban @user [reason]`");

  if (!target.bannable)
    return m.reply(error("I cannot ban this member."));

  const reason =
    args.slice(1).join(" ") ||
    "No reason provided";

  await target.ban({ reason });

  await modLog(
    m.guild,
    `${m.author} banned **${target.user.tag}**\nReason: ${reason}`
  );

  m.reply(success(`Banned **${target.user.tag}**.`));
});

command("kick", async (m, args) => {
  if (!m.member.permissions.has(PermissionsBitField.Flags.KickMembers))
    return m.reply(error("Kick Members permission required."));

  const target = mentionUser(m, args[0]);

  if (!target) return m.reply("Usage: `,kick @user [reason]`");

  if (!target.kickable)
    return m.reply(error("I cannot kick this member."));

  const reason =
    args.slice(1).join(" ") ||
    "No reason provided";

  await target.kick(reason);

  await modLog(
    m.guild,
    `${m.author} kicked **${target.user.tag}**\nReason: ${reason}`
  );

  m.reply(success(`Kicked **${target.user.tag}**.`));
});

command("unban", async (m, args) => {
  if (!m.member.permissions.has(PermissionsBitField.Flags.BanMembers))
    return m.reply(error("Ban Members permission required."));

  if (!args[0])
    return m.reply("Usage: `,unban <userID>`");

  try {
    await m.guild.members.unban(args[0]);
    m.reply(success("User unbanned."));
  } catch {
    m.reply(error("Couldn't unban that user."));
  }
});

command("warn", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  const target = mentionUser(m, args[0]);

  if (!target) return m.reply("Usage: `,warn @user [reason]`");

  const reason =
    args.slice(1).join(" ") ||
    "No reason provided";

  if (!db.warns[target.id]) db.warns[target.id] = [];

  db.warns[target.id].push({
    moderator: m.author.id,
    reason,
    time: Date.now()
  });

  save("warns.json", db.warns);

  m.reply(success(`Warned **${target.user.tag}**.`));

  await modLog(
    m.guild,
    `${m.author} warned **${target.user.tag}**\nReason: ${reason}`
  );
});

command("warnings", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  const target = mentionUser(m, args[0]);

  if (!target) return m.reply("Usage: `,warnings @user`");

  const list = db.warns[target.id] || [];

  if (!list.length)
    return m.reply("✅ This user has no warnings.");

  m.reply(
    `⚠️ **${target.user.tag}** has **${list.length} warnings**.\n\n` +
    list
      .map(
        (x, i) =>
          `**${i + 1}.** ${x.reason} — <@${x.moderator}>`
      )
      .join("\n")
  );
});

command("clearwarns", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  const target = mentionUser(m, args[0]);

  if (!target) return m.reply("Usage: `,clearwarns @user`");

  delete db.warns[target.id];

  save("warns.json", db.warns);

  m.reply(success("Warnings cleared."));
});

command("timeout", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  const target = mentionUser(m, args[0]);
  const minutes = Number(args[1]);

  if (!target || !minutes)
    return m.reply("Usage: `,timeout @user <minutes>`");

  if (!target.moderatable)
    return m.reply(error("I cannot timeout this member."));

  await target.timeout(
    minutes * 60 * 1000,
    args.slice(2).join(" ") || "No reason"
  );

  m.reply(
    success(
      `Timed out **${target.user.tag}** for **${minutes} minutes**.`
    )
  );
});

command("untimeout", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  const target = mentionUser(m, args[0]);

  if (!target)
    return m.reply("Usage: `,untimeout @user`");

  await target.timeout(null);

  m.reply(success(`Removed timeout from **${target.user.tag}**.`));
});

command("purge", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  const amount = Number(args[0]);

  if (!amount || amount < 1 || amount > 100)
    return m.reply("Usage: `,purge <1-100>`");

  await m.channel.bulkDelete(amount, true);

  const msg = await m.channel.send(
    success(`Deleted **${amount} messages**.`)
  );

  setTimeout(() => msg.delete().catch(() => {}), 3000);
});

command("slowmode", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  const seconds = Number(args[0]);

  if (isNaN(seconds) || seconds < 0 || seconds > 21600)
    return m.reply("Use a value from `0` to `21600`.");

  await m.channel.setRateLimitPerUser(seconds);

  m.reply(success(`Slowmode set to **${seconds}s**.`));
});

command("lock", async (m) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  await m.channel.permissionOverwrites.edit(
    m.guild.roles.everyone,
    {
      SendMessages: false
    }
  );

  m.reply("🔒 Channel locked.");
});

command("unlock", async (m) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  await m.channel.permissionOverwrites.edit(
    m.guild.roles.everyone,
    {
      SendMessages: null
    }
  );

  m.reply("🔓 Channel unlocked.");
});

command("nick", async (m, args) => {
  if (!isMod(m)) return m.reply(error("Moderation permission required."));

  const target = mentionUser(m, args[0]);

  if (!target)
    return m.reply("Usage: `,nick @user <nickname>`");

  const nickname = args.slice(1).join(" ");

  if (!nickname)
    return m.reply("❌ Nickname required.");

  await target.setNickname(nickname);

  m.reply(success(`Nickname changed for **${target.user.tag}**.`));
});

/* =========================================================
   ROLE MANAGEMENT
========================================================= */

command("role", async (m, args) => {
  if (!isAdmin(m)) return m.reply(error("Administrator required."));

  const target = mentionUser(m, args[0]);
  const role =
    m.mentions.roles.first() ||
    m.guild.roles.cache.get(args[1]);

  if (!target || !role)
    return m.reply("Usage: `,role @user @role`");

  await target.roles.add(role);

  m.reply(success(`Added ${role} to ${target}.`));
});

command("removerole", async (m, args) => {
  if (!isAdmin(m)) return m.reply(error("Administrator required."));

  const target = mentionUser(m, args[0]);
  const role =
    m.mentions.roles.first() ||
    m.guild.roles.cache.get(args[1]);

  if (!target || !role)
    return m.reply("Usage: `,removerole @user @role`");

  await target.roles.remove(role);

  m.reply(success(`Removed ${role} from ${target}.`));
});

/* =========================================================
   AFK
========================================================= */

command("afk", async (m, args) => {
  db.afk[m.author.id] = {
    reason: argsText(args) || "AFK",
    time: Date.now()
  };

  save("afk.json", db.afk);

  m.reply(`💤 AFK enabled: **${db.afk[m.author.id].reason}**`);
});

/* =========================================================
   ECONOMY
========================================================= */

command("balance", async (m) => {
  const u = money(m.author.id);

  m.reply(
    `💰 **${m.author.username}**\n` +
    `Wallet: **${u.balance}**\n` +
    `Bank: **${u.bank}**`
  );
});

command("daily", async (m) => {
  const u = money(m.author.id);

  const now = Date.now();

  if (now - u.lastDaily < 86400000) {
    const remaining =
      86400000 - (now - u.lastDaily);

    return m.reply(
      `⏰ Come back in **${Math.ceil(
        remaining / 3600000
      )} hours**.`
    );
  }

  const amount =
    Math.floor(Math.random() * 401) + 100;

  u.balance += amount;
  u.lastDaily = now;

  save("economy.json", db.economy);

  m.reply(`🎁 You received **${amount} coins**.`);
});

command("work", async (m) => {
  const u = money(m.author.id);

  const now = Date.now();

  if (now - u.lastWork < 60000)
    return m.reply("⏰ You need to wait before working again.");

  const amount =
    Math.floor(Math.random() * 201) + 50;

  u.balance += amount;
  u.lastWork = now;

  save("economy.json", db.economy);

  m.reply(`💼 You earned **${amount} coins**.`);
});

command("pay", async (m, args) => {
  const target = mentionUser(m, args[0]);
  const amount = Number(args[1]);

  if (!target || !amount || amount <= 0)
    return m.reply("Usage: `,pay @user <amount>`");

  const sender = money(m.author.id);
  const receiver = money(target.id);

  if (sender.balance < amount)
    return m.reply(error("You don't have enough coins."));

  sender.balance -= amount;
  receiver.balance += amount;

  save("economy.json", db.economy);

  m.reply(
    `💸 Sent **${amount} coins** to ${target}.`
  );
});

command("economylb", async (m) => {
  const sorted = Object.entries(db.economy)
    .sort((a, b) => b[1].balance - a[1].balance)
    .slice(0, 10);

  const text = sorted.length
    ? sorted
        .map(
          (x, i) =>
            `**${i + 1}.** <@${x[0]}> — ${x[1].balance}`
        )
        .join("\n")
    : "No data.";

  m.reply({
    embeds: [
      embed("💰 Economy Leaderboard", text)
    ]
  });
});

/* =========================================================
   LEVELING
========================================================= */

command("rank", async (m, args) => {
  const target = mentionUser(m, args[0]) || m.member;

  const u = levelUser(target.id);

  m.reply(
    `📈 **${target.user.username}**\n` +
    `Level: **${u.level}**\n` +
    `XP: **${u.xp}**`
  );
});

command("level", async (m, args) => {
  const target = mentionUser(m, args[0]) || m.member;

  const u = levelUser(target.id);

  m.reply(
    `📊 ${target} is level **${u.level}** with **${u.xp} XP**.`
  );
});

command("levelsettings", async (m, args) => {
  if (!isAdmin(m))
    return m.reply(error("Administrator required."));

  const config = guildConfig(m.guild.id);

  if (!args[0])
    return m.reply(
      `Leveling is currently **${
        config.leveling.enabled ? "enabled" : "disabled"
      }**.`
    );

  if (args[0].toLowerCase() === "on") {
    config.leveling.enabled = true;
    save("guilds.json", db.guilds);
    return m.reply(success("Leveling enabled."));
  }

  if (args[0].toLowerCase() === "off") {
    config.leveling.enabled = false;
    save("guilds.json", db.guilds);
    return m.reply(success("Leveling disabled."));
  }
});

command("leaderboard", async (m) => {
  const sorted = Object.entries(db.levels)
    .sort((a, b) => {
      if (b[1].level !== a[1].level)
        return b[1].level - a[1].level;

      return b[1].xp - a[1].xp;
    })
    .slice(0, 10);

  const text = sorted
    .map(
      (x, i) =>
        `**${i + 1}.** <@${x[0]}> — Level ${x[1].level} (${x[1].xp} XP)`
    )
    .join("\n");

  m.reply({
    embeds: [
      embed("📈 Level Leaderboard", text || "No data.")
    ]
  });
});

/* =========================================================
   FUN
========================================================= */

command("8ball", async (m, args) => {
  if (!args.length)
    return m.reply("Ask me a question.");

  const answers = [
    "Yes.",
    "No.",
    "Definitely.",
    "Probably.",
    "Probably not.",
    "Ask again later.",
    "Absolutely.",
    "I don't think so.",
    "Maybe."
  ];

  m.reply(
    `🎱 ${answers[Math.floor(Math.random() * answers.length)]}`
  );
});

command("coinflip", async (m) => {
  m.reply(
    Math.random() < 0.5
      ? "🪙 **Heads!**"
      : "🪙 **Tails!**"
  );
});

command("dice", async (m) => {
  m.reply(
    `🎲 You rolled **${
      Math.floor(Math.random() * 6) + 1
    }**.`
  );
});

command("choose", async (m, args) => {
  if (args.length < 2)
    return m.reply("Usage: `,choose option1 option2 option3`");

  const choice =
    args[Math.floor(Math.random() * args.length)];

  m.reply(`🤔 I choose **${choice}**`);
});

command("rate", async (m, args) => {
  if (!args.length)
    return m.reply("Usage: `,rate <thing>`");

  m.reply(
    `⭐ I rate **${argsText(args)}** **${
      Math.floor(Math.random() * 10) + 1
    }/10**`
  );
});

command("compliment", async (m, args) => {
  const target =
    mentionUser(m, args[0]) ||
    m.member;

  const list = [
    "You're awesome!",
    "You're a legend!",
    "You're doing great!",
    "You're really cool!",
    "You're amazing!",
    "You've got this!"
  ];

  m.reply(
    `✨ ${target} ${
      list[Math.floor(Math.random() * list.length)]
    }`
  );
});

command("roast", async (m, args) => {
  const target =
    mentionUser(m, args[0]) ||
    m.member;

  const list = [
    "Your WiFi has better personality than you.",
    "Even the loading screen gets tired of waiting for you.",
    "You bring absolutely nothing to the table.",
    "Your luck needs an update."
  ];

  m.reply(
    `🔥 ${target} ${
      list[Math.floor(Math.random() * list.length)]
    }`
  );
});

command("ship", async (m, args) => {
  const a =
    mentionUser(m, args[0]) ||
    m.member;

  const b =
    mentionUser(m, args[1]) ||
    m.guild.members.cache.random();

  const percent =
    Math.floor(Math.random() * 101);

  m.reply(
    `💞 ${a} + ${b}\n\n` +
    `**Compatibility:** ${percent}%`
  );
});

/* =========================================================
   REMINDERS
========================================================= */

command("remind", async (m, args) => {
  const seconds = Number(args[0]);

  if (!seconds || !args[1])
    return m.reply(
      "Usage: `,remind <seconds> <message>`"
    );

  const text = args.slice(1).join(" ");

  m.reply(
    `⏰ Reminder set for **${seconds} seconds**.`
  );

  setTimeout(() => {
    m.author.send(`⏰ **Reminder:** ${text}`)
      .catch(() => {});
  }, seconds * 1000);
});

/* =========================================================
   INVITES
========================================================= */

command("invites", async (m, args) => {
  const target =
    m.mentions.members.first() ||
    m.member;

  const amount =
    db.invites[target.id]?.uses || 0;

  m.reply(
    `🔗 **${target.user.username}** has **${amount} invites**.`
  );
});

command("inviteinfo", async (m) => {
  m.reply(
    "🔗 Invite tracking is enabled through the server's invite cache."
  );
});

command("invitelb", async (m) => {
  const list = Object.entries(db.invites)
    .sort((a, b) =>
      (b[1]?.uses || 0) -
      (a[1]?.uses || 0)
    )
    .slice(0, 10);

  const text =
    list.map(
      (x, i) =>
        `**${i + 1}.** <@${x[0]}> — ${x[1].uses || 0}`
    ).join("\n") ||
    "No invite data.";

  m.reply({
    embeds: [
      embed("🔗 Invite Leaderboard", text)
    ]
  });
});

/* =========================================================
   TICKETS
========================================================= */

command("ticket", async (m) => {
  const config = guildConfig(m.guild.id);

  if (!config.tickets.enabled)
    return m.reply(
      "❌ Tickets are not enabled. An administrator can use `,setup tickets`."
    );

  const channel = await m.guild.channels.create({
    name: `ticket-${m.author.username}`.toLowerCase(),
    type: ChannelType.GuildText,
    parent: config.tickets.category || undefined,
    permissionOverwrites: [
      {
        id: m.guild.roles.everyone.id,
        deny: [
          PermissionsBitField.Flags.ViewChannel
        ]
      },
      {
        id: m.author.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages
        ]
      }
    ]
  });

  db.tickets[channel.id] = {
    owner: m.author.id,
    opened: Date.now()
  };

  save("tickets.json", db.tickets);

  channel.send(
    `🎫 Welcome ${m.author}!\n\n` +
    `A staff member will assist you shortly.\n` +
    `Use \`,close\` to close this ticket.`
  );

  m.reply(
    `🎫 Ticket created: ${channel}`
  );
});

command("close", async (m) => {
  if (!db.tickets[m.channel.id])
    return m.reply("❌ This isn't a ticket.");

  if (
    db.tickets[m.channel.id].owner !== m.author.id &&
    !isMod(m)
  ) {
    return m.reply(error("You cannot close this ticket."));
  }

  await m.reply("🔒 Closing ticket...");

  setTimeout(() => {
    m.channel.delete().catch(() => {});
  }, 2000);
});

command("claim", async (m) => {
  if (!db.tickets[m.channel.id])
    return m.reply("❌ This isn't a ticket.");

  if (!isMod(m))
    return m.reply(error("Staff only."));

  db.tickets[m.channel.id].claimed = m.author.id;

  save("tickets.json", db.tickets);

  m.reply(`🎫 Ticket claimed by ${m.author}.`);
});

command("add", async (m, args) => {
  if (!db.tickets[m.channel.id])
    return m.reply("❌ This isn't a ticket.");

  if (!isMod(m))
    return m.reply(error("Staff only."));

  const user =
    m.mentions.members.first() ||
    m.guild.members.cache.get(args[0]);

  if (!user)
    return m.reply("Usage: `,add @user`");

  await m.channel.permissionOverwrites.edit(
    user.id,
    {
      ViewChannel: true,
      SendMessages: true
    }
  );

  m.reply(success(`Added ${user} to the ticket.`));
});

command("remove", async (m) => {
  if (!db.tickets[m.channel.id])
    return m.reply("❌ This isn't a ticket.");

  if (!isMod(m))
    return m.reply(error("Staff only."));

  const user =
    m.mentions.members.first();

  if (!user)
    return m.reply("Usage: `,remove @user`");

  await m.channel.permissionOverwrites.delete(
    user.id
  );

  m.reply(success(`Removed ${user} from the ticket.`));
});

/* =========================================================
   GIVEAWAYS
========================================================= */

command("giveaway", async (m, args) => {
  if (!isMod(m))
    return m.reply(error("Moderation permission required."));

  const seconds = Number(args[0]);
  const prize = args.slice(1).join(" ");

  if (!seconds || !prize)
    return m.reply(
      "Usage: `,giveaway <seconds> <prize>`"
    );

  const giveaway = await m.channel.send({
    embeds: [
      embed(
        "🎉 GIVEAWAY",
        `Prize: **${prize}**\n\n` +
        `React with 🎉 to enter!\n` +
        `Ends in **${seconds} seconds**`
      )
    ]
  });

  await giveaway.react("🎉");

  db.giveaways[giveaway.id] = {
    channel: m.channel.id,
    prize,
    ends: Date.now() + seconds * 1000
  };

  save("giveaways.json", db.giveaways);

  setTimeout(async () => {
    try {
      const channel = await client.channels.fetch(
        m.channel.id
      );

      const msg = await channel.messages.fetch(
        giveaway.id
      );

      const reaction =
        msg.reactions.cache.get("🎉");

      if (!reaction) return;

      const users =
        await reaction.users.fetch();

      const entries =
        users.filter(u => !u.bot);

      if (!entries.size) {
        return channel.send(
          "🎉 Giveaway ended but nobody entered."
        );
      }

      const winner =
        entries.random();

      channel.send(
        `🎉 Congratulations ${winner}!\n` +
        `You won **${prize}**!`
      );
    } catch {}
  }, seconds * 1000);
});

command("gend", async (m) => {
  if (!isMod(m))
    return m.reply(error("Moderation permission required."));

  const giveaway =
    db.giveaways[m.channel.id];

  if (!giveaway)
    return m.reply("❌ No giveaway found.");

  m.reply("🎉 Giveaway ending.");
});

command("reroll", async (m) => {
  if (!isMod(m))
    return m.reply(error("Moderation permission required."));

  const message =
    m.reference
      ? await m.channel.messages.fetch(
          m.reference.messageId
        )
      : null;

  if (!message)
    return m.reply("Reply to the giveaway message.");

  const reaction =
    message.reactions.cache.get("🎉");

  if (!reaction)
    return m.reply("❌ No entries found.");

  const users =
    await reaction.users.fetch();

  const entries =
    users.filter(u => !u.bot);

  if (!entries.size)
    return m.reply("❌ Nobody entered.");

  const winner =
    entries.random();

  m.channel.send(
    `🎉 New winner: ${winner}!`
  );
});

/* =========================================================
   SETUP
========================================================= */

command("setup", async (m, args) => {
  if (!isAdmin(m))
    return m.reply(error("Administrator permission required."));

  const config = guildConfig(m.guild.id);

  if (!args[0]) {
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("setup_welcome")
          .setLabel("Welcome")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("setup_logs")
          .setLabel("Logs")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("setup_tickets")
          .setLabel("Tickets")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("setup_automod")
          .setLabel("AutoMod")
          .setStyle(ButtonStyle.Danger)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("setup_leveling")
          .setLabel("Leveling")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("setup_suggestions")
          .setLabel("Suggestions")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("setup_invites")
          .setLabel("Invites")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("setup_config")
          .setLabel("View Config")
          .setStyle(ButtonStyle.Secondary)
      );

    return m.reply({
      embeds: [
        embed(
          "⚙️ Server Setup",
          "Choose a system to configure.\n\n" +
          "You can also use:\n" +
          "`,setup all`\n" +
          "`,setup welcome #channel`\n" +
          "`,setup logs #channel`\n" +
          "`,setup tickets`\n" +
          "`,setup automod`"
        )
      ],
      components: [row1, row2]
    });
  }

  const option = args[0].toLowerCase();

  /* WELCOME */

  if (option === "welcome") {
    const channel =
      m.mentions.channels.first();

    if (!channel) {
      return m.reply(
        "Usage: `,setup welcome #channel`"
      );
    }

    config.welcome.enabled = true;
    config.welcome.channel = channel.id;

    save("guilds.json", db.guilds);

    return m.reply(
      success(`Welcome messages enabled in ${channel}.`)
    );
  }

  /* GOODBYE */

  if (option === "goodbye") {
    const channel =
      m.mentions.channels.first();

    if (!channel)
      return m.reply(
        "Usage: `,setup goodbye #channel`"
      );

    config.goodbye.enabled = true;
    config.goodbye.channel = channel.id;

    save("guilds.json", db.guilds);

    return m.reply(
      success(`Goodbye messages enabled in ${channel}.`)
    );
  }

  /* LOGS */

  if (
    option === "logs" ||
    option === "modlogs"
  ) {
    const channel =
      m.mentions.channels.first();

    if (!channel)
      return m.reply(
        `Usage: \`,setup ${option} #channel\``
      );

    if (option === "logs") {
      config.logs.enabled = true;
      config.logs.channel = channel.id;
    } else {
      config.modlogs.enabled = true;
      config.modlogs.channel = channel.id;
    }

    save("guilds.json", db.guilds);

    return m.reply(
      success(`${option} enabled in ${channel}.`)
    );
  }

  /* AUTOROLE */

  if (option === "autorole") {
    const role =
      m.mentions.roles.first();

    if (!role)
      return m.reply(
        "Usage: `,setup autorole @role`"
      );

    config.autorole = role.id;

    save("guilds.json", db.guilds);

    return m.reply(
      success(`Autorole set to ${role}.`)
    );
  }

  /* TICKETS */

  if (option === "tickets") {
    let category =
      m.mentions.channels.first();

    if (!category) {
      category =
        m.guild.channels.cache.find(
          c =>
            c.type === ChannelType.GuildCategory &&
            c.name.toLowerCase() === "tickets"
        );
    }

    if (!category) {
      category =
        await m.guild.channels.create({
          name: "Tickets",
          type: ChannelType.GuildCategory
        });
    }

    config.tickets.enabled = true;
    config.tickets.category = category.id;

    save("guilds.json", db.guilds);

    return m.reply(
      success(`Tickets enabled using ${category.name}.`)
    );
  }

  /* LEVELING */

  if (option === "leveling") {
    config.leveling.enabled = true;

    save("guilds.json", db.guilds);

    return m.reply(
      success("Leveling enabled.")
    );
  }

  /* INVITES */

  if (option === "invites") {
    config.invites.enabled = true;

    save("guilds.json", db.guilds);

    return m.reply(
      success("Invite tracking enabled.")
    );
  }

  /* SUGGESTIONS */

  if (option === "suggestions") {
    const channel =
      m.mentions.channels.first();

    if (!channel)
      return m.reply(
        "Usage: `,setup suggestions #channel`"
      );

    config.suggestions.enabled = true;
    config.suggestions.channel = channel.id;

    save("guilds.json", db.guilds);

    return m.reply(
      success(`Suggestions enabled in ${channel}.`)
    );
  }

  /* AUTOMOD */

  if (option === "automod") {
    config.automod.enabled = true;

    save("guilds.json", db.guilds);

    return m.reply(
      success("AutoMod enabled.")
    );
  }

  /* ALL */

  if (option === "all") {
    config.welcome.enabled = true;
    config.logs.enabled = true;
    config.modlogs.enabled = true;
    config.tickets.enabled = true;
    config.leveling.enabled = true;
    config.invites.enabled = true;
    config.automod.enabled = true;
    config.suggestions.enabled = true;

    save("guilds.json", db.guilds);

    return m.reply(
      success(
        "Major systems have been enabled. Use `,config` to review them."
      )
    );
  }

  m.reply(
    "❌ Unknown setup option. Use `,setup` to view the setup panel."
  );
});

/* =========================================================
   CONFIG
========================================================= */

command("config", async (m) => {
  if (!isAdmin(m))
    return m.reply(error("Administrator required."));

  const c = guildConfig(m.guild.id);

  m.reply({
    embeds: [
      embed(
        "⚙️ Server Configuration",
        `**Prefix:** \`,\`\n\n` +
        `👋 Welcome: **${c.welcome.enabled ? "ON" : "OFF"}**\n` +
        `📜 Logs: **${c.logs.enabled ? "ON" : "OFF"}**\n` +
        `🛡️ Mod Logs: **${c.modlogs.enabled ? "ON" : "OFF"}**\n` +
        `🎫 Tickets: **${c.tickets.enabled ? "ON" : "OFF"}**\n` +
        `📈 Leveling: **${c.leveling.enabled ? "ON" : "OFF"}**\n` +
        `🔗 Invites: **${c.invites.enabled ? "ON" : "OFF"}**\n` +
        `🤖 AutoMod: **${c.automod.enabled ? "ON" : "OFF"}**\n` +
        `💡 Suggestions: **${c.suggestions.enabled ? "ON" : "OFF"}**`
      )
    ]
  });
});

command("setprefix", async (m, args) => {
  if (!isAdmin(m))
    return m.reply(error("Administrator required."));

  /*
    Prefix is intentionally fixed to ,
    for this version.
  */

  m.reply(
    "🔒 The prefix for this bot is permanently set to `,`."
  );
});

/* =========================================================
   CUSTOM COMMANDS
========================================================= */

command("customadd", async (m, args) => {
  if (!isAdmin(m))
    return m.reply(error("Administrator required."));

  const name = args.shift();

  if (!name || !args.length)
    return m.reply(
      "Usage: `,customadd <name> <response>`"
    );

  if (!db.custom[m.guild.id])
    db.custom[m.guild.id] = {};

  db.custom[m.guild.id][name.toLowerCase()] =
    argsText(args);

  save("custom.json", db.custom);

  m.reply(
    success(`Created custom command \`,${name}\`.`)
  );
});

command("customremove", async (m, args) => {
  if (!isAdmin(m))
    return m.reply(error("Administrator required."));

  if (!db.custom[m.guild.id]?.[args[0]])
    return m.reply("❌ Custom command not found.");

  delete db.custom[m.guild.id][args[0]];

  save("custom.json", db.custom);

  m.reply(success("Custom command removed."));
});

command("customlist", async (m) => {
  const list =
    Object.keys(db.custom[m.guild.id] || {});

  m.reply(
    list.length
      ? `🧰 Custom commands:\n${list.map(x => `\`,${x}\``).join("\n")}`
      : "No custom commands."
  );
});

/* =========================================================
   OWNER
========================================================= */

command("servers", async (m) => {
  if (!isOwner(m))
    return m.reply(error("Owner only."));

  m.reply(
    `👑 I'm currently in **${client.guilds.cache.size} servers**.`
  );
});

command("broadcast", async (m, args) => {
  if (!isOwner(m))
    return m.reply(error("Owner only."));

  const text = argsText(args);

  if (!text)
    return m.reply("Usage: `,broadcast <message>`");

  let sent = 0;

  for (const guild of client.guilds.cache.values()) {
    const channel = guild.systemChannel;

    if (!channel) continue;

    channel.send(text)
      .then(() => sent++)
      .catch(() => {});
  }

  m.reply(
    `📢 Broadcast attempted in **${client.guilds.cache.size} servers**.`
  );
});

command("status", async (m, args) => {
  if (!isOwner(m))
    return m.reply(error("Owner only."));

  const text = argsText(args);

  if (!text)
    return m.reply("Usage: `,status <text>`");

  client.user.setPresence({
    activities: [
      {
        name: text
      }
    ],
    status: "online"
  });

  m.reply(success("Bot status updated."));
});

command("maintenance", async (m, args) => {
  if (!isOwner(m))
    return m.reply(error("Owner only."));

  const state =
    args[0]?.toLowerCase();

  if (!["on", "off"].includes(state))
    return m.reply(
      "Usage: `,maintenance on` or `,maintenance off`"
    );

  client.maintenance = state === "on";

  m.reply(
    success(
      `Maintenance mode ${client.maintenance ? "enabled" : "disabled"}.`
    )
  );
});

/* =========================================================
   BUTTON SETUP HANDLER
========================================================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (!interaction.customId.startsWith("setup_"))
    return;

  if (!interaction.member.permissions.has(
    PermissionsBitField.Flags.Administrator
  )) {
    return interaction.reply({
      content: "❌ Administrator permission required.",
      ephemeral: true
    });
  }

  const config = guildConfig(
    interaction.guild.id
  );

  const type =
    interaction.customId.replace("setup_", "");

  if (type === "welcome") {
    config.welcome.enabled = true;
    config.welcome.channel = interaction.channel.id;

    save("guilds.json", db.guilds);

    return interaction.reply({
      content:
        `👋 Welcome system enabled in ${interaction.channel}.`,
      ephemeral: true
    });
  }

  if (type === "logs") {
    config.logs.enabled = true;
    config.logs.channel = interaction.channel.id;

    save("guilds.json", db.guilds);

    return interaction.reply({
      content:
        `📜 Logging enabled in ${interaction.channel}.`,
      ephemeral: true
    });
  }

  if (type === "tickets") {
    config.tickets.enabled = true;

    save("guilds.json", db.guilds);

    return interaction.reply({
      content:
        "🎫 Tickets enabled. Use `,ticket` to create one.",
      ephemeral: true
    });
  }

  if (type === "automod") {
    config.automod.enabled = true;

    save("guilds.json", db.guilds);

    return interaction.reply({
      content:
        "🤖 AutoMod enabled.",
      ephemeral: true
    });
  }

  if (type === "leveling") {
    config.leveling.enabled = true;

    save("guilds.json", db.guilds);

    return interaction.reply({
      content:
        "📈 Leveling enabled.",
      ephemeral: true
    });
  }

  if (type === "suggestions") {
    config.suggestions.enabled = true;
    config.suggestions.channel =
      interaction.channel.id;

    save("guilds.json", db.guilds);

    return interaction.reply({
      content:
        `💡 Suggestions enabled in ${interaction.channel}.`,
      ephemeral: true
    });
  }

  if (type === "invites") {
    config.invites.enabled = true;

    save("guilds.json", db.guilds);

    return interaction.reply({
      content:
        "🔗 Invite tracking enabled.",
      ephemeral: true
    });
  }

  if (type === "config") {
    return interaction.reply({
      content:
        `⚙️ Welcome: ${config.welcome.enabled}\n` +
        `📜 Logs: ${config.logs.enabled}\n` +
        `🎫 Tickets: ${config.tickets.enabled}\n` +
        `📈 Leveling: ${config.leveling.enabled}\n` +
        `🔗 Invites: ${config.invites.enabled}\n` +
        `🤖 AutoMod: ${config.automod.enabled}`,
      ephemeral: true
    });
  }
});

/* =========================================================
   MEMBER JOIN
========================================================= */

client.on("guildMemberAdd", async member => {
  const config =
    guildConfig(member.guild.id);

  /* Welcome */

  if (
    config.welcome.enabled &&
    config.welcome.channel
  ) {
    const channel =
      member.guild.channels.cache.get(
        config.welcome.channel
      );

    if (channel) {
      const text =
        config.welcome.message
          .replace(
            /{user}/g,
            member.toString()
          )
          .replace(
            /{server}/g,
            member.guild.name
          );

      channel.send(text).catch(() => {});
    }
  }

  /* Autorole */

  if (config.autorole) {
    const role =
      member.guild.roles.cache.get(
        config.autorole
      );

    if (role) {
      member.roles.add(role).catch(() => {});
    }
  }

  await logAction(
    member.guild,
    `👋 **${member.user.tag}** joined the server.`
  );
});

/* =========================================================
   MEMBER LEAVE
========================================================= */

client.on("guildMemberRemove", async member => {
  const config =
    guildConfig(member.guild.id);

  if (
    config.goodbye.enabled &&
    config.goodbye.channel
  ) {
    const channel =
      member.guild.channels.cache.get(
        config.goodbye.channel
      );

    if (channel) {
      const text =
        config.goodbye.message
          .replace(
            /{user}/g,
            member.user.tag
          )
          .replace(
            /{server}/g,
            member.guild.name
          );

      channel.send(text).catch(() => {});
    }
  }

  await logAction(
    member.guild,
    `👋 **${member.user.tag}** left the server.`
  );
});

/* =========================================================
   MESSAGE EVENTS
========================================================= */

client.on("messageDelete", async message => {
  if (!message.guild || message.author?.bot)
    return;

  await logAction(
    message.guild,
    `🗑️ Message deleted in ${message.channel}\n` +
    `Author: **${message.author?.tag || "Unknown"}**\n` +
    `Content: ${message.content?.slice(0, 1000) || "Unknown"}`
  );
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!oldMessage.guild)
    return;

  if (
    oldMessage.content === newMessage.content
  )
    return;

  await logAction(
    oldMessage.guild,
    `✏️ Message edited in ${oldMessage.channel}\n` +
    `Author: **${oldMessage.author?.tag || "Unknown"}**`
  );
});

/* =========================================================
   MESSAGE COMMAND HANDLER
========================================================= */

client.on("messageCreate", async message => {
  if (message.author.bot)
    return;

  /* Remove AFK */

  if (db.afk[message.author.id]) {
    delete db.afk[message.author.id];

    save("afk.json", db.afk);

    message.reply(
      "👋 Welcome back! Your AFK has been removed."
    ).catch(() => {});
  }

  /* AFK mentions */

  for (const user of message.mentions.users.values()) {
    if (db.afk[user.id]) {
      message.reply(
        `💤 **${user.username}** is AFK: ${db.afk[user.id].reason}`
      ).catch(() => {});
    }
  }

  if (!message.guild)
    return;

  /* Level XP */

  const config =
    guildConfig(message.guild.id);

  if (
    config.leveling.enabled &&
    message.content.length > 3
  ) {
    const u =
      levelUser(message.author.id);

    u.xp += Math.floor(
      Math.random() * 16
    ) + 10;

    const required =
      u.level * 100;

    if (u.xp >= required) {
      u.xp -= required;
      u.level++;

      message.channel.send(
        `🎉 Congratulations ${message.author}! You reached **Level ${u.level}**!`
      ).catch(() => {});
    }

    save("levels.json", db.levels);
  }

  /* AutoMod */

  if (
    config.automod.enabled &&
    !isMod(message)
  ) {
    const content =
      message.content.toLowerCase();

    if (
      config.automod.antiInvites &&
      /discord\.gg\/|discord\.com\/invite\//i.test(
        content
      )
    ) {
      await message.delete().catch(() => {});

      return message.channel.send(
        `🚫 ${message.author} Discord invites aren't allowed here.`
      ).then(msg => {
        setTimeout(
          () => msg.delete().catch(() => {}),
          5000
        );
      });
    }

    if (
      config.automod.antiLinks &&
      /https?:\/\//i.test(content)
    ) {
      await message.delete().catch(() => {});

      return message.channel.send(
        `🚫 ${message.author} links aren't allowed here.`
      ).then(msg => {
        setTimeout(
          () => msg.delete().catch(() => {}),
          5000
        );
      });
    }

    if (
      config.automod.antiMentions &&
      message.mentions.users.size >= 5
    ) {
      await message.delete().catch(() => {});

      return message.channel.send(
        `🚫 ${message.author} too many mentions.`
      ).then(msg => {
        setTimeout(
          () => msg.delete().catch(() => {}),
          5000
        );
      });
    }
  }

  /* Custom commands */

  if (
    db.custom[message.guild.id] &&
    db.custom[message.guild.id][
      message.content.slice(1).split(/\s+/)[0]?.toLowerCase()
    ]
  ) {
    const name =
      message.content
        .slice(1)
        .split(/\s+/)[0]
        .toLowerCase();

    return message.channel.send(
      db.custom[message.guild.id][name]
        .replace(
          /{user}/g,
          message.author.toString()
        )
        .replace(
          /{server}/g,
          message.guild.name
        )
    );
  }

  /* Prefix */

  if (!message.content.startsWith(PREFIX))
    return;

  const raw =
    message.content.slice(PREFIX.length).trim();

  if (!raw)
    return;

  const args =
    raw.split(/\s+/);

  const name =
    args.shift().toLowerCase();

  /* Maintenance */

  if (
    client.maintenance &&
    !isOwner(message)
  ) {
    return message.reply(
      "🔧 The bot is currently in maintenance mode."
    );
  }

  const cmd =
    commands.get(name);

  if (!cmd) {
    return;
  }

  try {
    await cmd(message, args);
  } catch (err) {
    console.error(
      `Command error [${name}]:`,
      err
    );

    message.reply(
      "❌ An error occurred while running that command."
    ).catch(() => {});
  }
});

/* =========================================================
   READY
========================================================= */

client.once("ready", () => {
  console.log("=================================");
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`📌 Prefix: ${PREFIX}`);
  console.log(`📦 Commands: ${commands.size}`);
  console.log(`🌐 Servers: ${client.guilds.cache.size}`);
  console.log("=================================");

  client.user.setPresence({
    activities: [
      {
        name: ",help"
      }
    ],
    status: "online"
  });
});

/* =========================================================
   ERROR HANDLING
========================================================= */

process.on("unhandledRejection", error => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("Uncaught exception:", error);
});

/* =========================================================
   LOGIN
========================================================= */

client.login(TOKEN);
