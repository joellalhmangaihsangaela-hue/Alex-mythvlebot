import os
import discord
from discord.ext import commands

TOKEN = os.getenv("DISCORD_TOKEN")
PREFIX = ","

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(
    command_prefix=PREFIX,
    intents=intents,
    help_command=None
)


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")
    print(f"Prefix: {PREFIX}")
    print(f"Servers: {len(bot.guilds)}")


@bot.command()
async def ping(ctx):
    await ctx.send(f"🏓 Pong! `{round(bot.latency * 1000)}ms`")


@bot.command()
async def say(ctx, *, message):
    if not ctx.author.guild_permissions.manage_messages:
        return await ctx.send("❌ You need Manage Messages permission.")

    await ctx.message.delete()
    await ctx.send(message)


@bot.command()
async def serverinfo(ctx):
    guild = ctx.guild

    embed = discord.Embed(
        title="📊 Server Information",
        description=(
            f"**Name:** {guild.name}\n"
            f"**Members:** {guild.member_count}\n"
            f"**Channels:** {len(guild.channels)}\n"
            f"**Roles:** {len(guild.roles)}"
        )
    )

    await ctx.send(embed=embed)


@bot.command()
async def userinfo(ctx, member: discord.Member = None):
    member = member or ctx.author

    embed = discord.Embed(
        title="👤 User Information
