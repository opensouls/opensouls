
export const OUR_GUILD_ID = '1099805146814365698';

// Function to fetch user guilds from Discord
export async function fetchUserGuilds(bearerToken: string): Promise<any[]> {
  const response = await fetch('https://discord.com/api/v9/users/@me/guilds', {
    headers: {
      Authorization: `Bearer ${bearerToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user guilds');
  }

  return response.json();
}

// Function to check if user is a member of a specific guild
export async function isUserInGuild(bearerToken: string, guildId: string): Promise<boolean> {
  try {
    const guilds = await fetchUserGuilds(bearerToken);
    return guilds.some(guild => guild.id === guildId);
  } catch (error) {
    console.error('Error checking guild membership:', error);
    return false;
  }
}
