require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.GuildMember]
});

const invites = new Map();

// STEP 4: Cache Invites + Handle Member Join
client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.guilds.cache.forEach(async guild => {
    const guildInvites = await guild.invites.fetch();
    invites.set(guild.id, guildInvites);
  });
});

client.on('inviteCreate', async invite => {
  const guildInvites = await invite.guild.invites.fetch();
  invites.set(invite.guild.id, guildInvites);
});

client.on('guildMemberAdd', async member => {
  const cachedInvites = invites.get(member.guild.id);
  const newInvites = await member.guild.invites.fetch();

  const usedInvite = newInvites.find(i => {
    const oldUses = cachedInvites.get(i.code)?.uses || 0;
    return i.uses > oldUses;
  });

  if (!usedInvite) return console.log("Could not find inviter");

  const inviter = usedInvite.inviter;
  console.log(`${member.user.tag} was invited by ${inviter.tag}`);

  const groupRole = getGroupRoleFromInviter(inviter);
  if (groupRole) {
    const role = member.guild.roles.cache.find(r => r.name === groupRole);
    if (role) await member.roles.add(role);
  }

  invites.set(member.guild.id, newInvites);
});

function getGroupRoleFromInviter(inviter) {
  const roles = inviter.roles.cache;
  if (roles.some(role => role.name === "Admin-GroupA")) return "GroupA";
  if (roles.some(role => role.name === "Admin-GroupB")) return "GroupB";
  return null;
}

// STEP 5: Kick Command - Only Same Group
client.on("messageCreate", async message => {
  if (!message.content.startsWith("!kick") || message.author.bot) return;

  const target = message.mentions.members.first();
  if (!target) return message.reply("Mention a user to kick.");

  const authorRoles = message.member.roles.cache;
  const targetRoles = target.roles.cache;

  const group = getGroupFromRoles(authorRoles);
  if (!group || !targetRoles.some(r => r.name === group)) {
    return message.reply("You can only kick members from your own group.");
  }

  await target.kick(`Kicked by group admin`);
  message.reply(`${target.user.tag} has been kicked.`);
});

function getGroupFromRoles(roles) {
  if (roles.some(r => r.name === "Admin-GroupA")) return "GroupA";
  if (roles.some(r => r.name === "Admin-GroupB")) return "GroupB";
  return null;
}

// STEP 6: Prevent Manual Group Adds
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));

  addedRoles.forEach(async role => {
    if (role.name.startsWith("Group")) {
      const admin = await newMember.guild.members.fetch(newMember.id);
      const isAdmin = admin.roles.cache.some(r => r.name.startsWith("Admin-"));
      if (isAdmin) {
        await newMember.roles.remove(role);
        admin.send(`You can't manually assign group roles. Invites only.`);
      }
    }
  });
});

client.login(process.env.DISCORD_TOKEN);
