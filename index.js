require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

const captchas = {}; // Store captcha settings for each guild
const userCaptchas = {}; // Store user-specific CAPTCHAs
const embedSettings = {}; // Store embed settings for each guild
const afkUsers = {}; // Store AFK status for users

// Function to generate a random CAPTCHA
const generateCaptcha = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let captcha = '';
    for (let i = 0; i < length; i++) {
        captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return captcha;
};

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Set the bot's presence
    client.user.setPresence({
        activities: [
            {
                name: 'Wisteria',
                type: 'WATCHING' // PLAYING, LISTENING, or STREAMING can be used as well
            }
        ],
        status: 'dnd' // 'online', 'idle', 'dnd', or 'invisible'
    });

    console.log('Bot presence set successfully!');
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    registerCommands();
});

async function registerCommands() {
    const commands = [
        {
            name: 'setupcaptcha',
            description: 'Set both the role to assign and the channel for CAPTCHA messages',
            options: [
                {
                    name: 'role',
                    type: 8, // ROLE type
                    description: 'The role to assign after verification',
                    required: true,
                },
                {
                    name: 'channel',
                    type: 7, // CHANNEL type
                    description: 'The channel for CAPTCHA messages',
                    required: true,
                },
            ],
        },
        {
            name: 'setcaptchaembed',
            description: 'Set the title, description, and color for the CAPTCHA embed',
            options: [
                {
                    name: 'title',
                    type: 3, // STRING type
                    description: 'The title for the embed',
                    required: true,
                },
                {
                    name: 'description',
                    type: 3, // STRING type
                    description: 'The description for the embed',
                    required: true,
                },
                {
                    name: 'color',
                    type: 3, // STRING type
                    description: 'The color for the embed (hex code, e.g., #ff0000)',
                    required: false,
                },
            ],
        },
        {
            name: 'sendcaptcha',
            description: 'Send the CAPTCHA panel to the configured channel',
        },
        {
            name: 'afk',
            description: 'Set your AFK status',
            options: [
                {
                    name: 'message',
                    type: 3, // STRING type
                    description: 'Optional message to display while you are AFK',
                    required: false,
                },
            ],
        },
        {
            name: 'say',
            description: 'Make the bot send a message with the specified content',
            options: [
                {
                    name: 'message',
                    type: 3, // STRING type
                    description: 'The message you want the bot to say',
                    required: true,
                },
                {
                    name: 'channel',
                    type: 7, // CHANNEL type
                    description: 'The channel where the bot should send the message (optional)',
                    required: false,
                },
            ],
        },
    ];

    const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);
    
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('Successfully registered application commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return; // Ensure it's a command

    const { commandName, options } = interaction;

    try {
        if (commandName === 'setupcaptcha') {
            const role = options.getRole('role');
            const channel = options.getChannel('channel');
            if (!captchas[interaction.guild.id]) captchas[interaction.guild.id] = {};

            // Set both the role and the channel
            captchas[interaction.guild.id].role = role.id;
            captchas[interaction.guild.id].channel = channel.id;
            
            await interaction.reply(`Verification role set to **${role.name}** and CAPTCHA channel set to **${channel.name}**.`);
        } else if (commandName === 'setcaptchaembed') {
            const title = options.getString('title');
            const description = options.getString('description');
            const color = options.getString('color');

            if (!embedSettings[interaction.guild.id]) embedSettings[interaction.guild.id] = {};
            embedSettings[interaction.guild.id].title = title;
            embedSettings[interaction.guild.id].description = description;

            if (color) {
                if (!/^#([0-9A-F]{3}){1,2}$/i.test(color)) {
                    await interaction.reply({ content: 'Please provide a valid hex color code (e.g., #ff0000).', ephemeral: true });
                    return;
                }
                embedSettings[interaction.guild.id].color = color;
            }

            await interaction.reply(`Embed settings updated: **Title**: ${title}, **Description**: ${description}${color ? `, **Color**: ${color}` : ''}`);
        } else if (commandName === 'sendcaptcha') {
            const settings = captchas[interaction.guild.id];
            if (!settings || !settings.channel) {
                return interaction.reply('Please set the channel first using `/setupcaptcha`.');
            }

            const channel = interaction.guild.channels.cache.get(settings.channel);
            const embed = new EmbedBuilder()
                .setColor(embedSettings[interaction.guild.id]?.color || '#0099ff')
                .setTitle(embedSettings[interaction.guild.id]?.title || 'CAPTCHA Verification')
                .setDescription(embedSettings[interaction.guild.id]?.description || 'Click the button below to receive your CAPTCHA.');

            const button = new ButtonBuilder()
                .setCustomId('get_captcha')
                .setLabel('Get CAPTCHA')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);

            // Send the embed message with the button
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.reply('CAPTCHA panel sent to the channel.');
        } else if (commandName === 'afk') {
            const afkMessage = options.getString('message') || 'AFK';
            afkUsers[interaction.user.id] = { message: afkMessage, time: Date.now() };
            await interaction.reply(`You are now AFK: ${afkMessage}`);
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (!interaction.replied) {
            await interaction.reply('There was an error while executing the command. Please try again.');
        }
    }
});

// Handle message events for AFK
client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignore bot messages

    // Check if the author is AFK
    if (afkUsers[message.author.id]) {
        const afkInfo = afkUsers[message.author.id];
        // Remove the user from AFK status
        delete afkUsers[message.author.id];
        await message.reply(`Welcome back! You were AFK: ${afkInfo.message}`);
    }

    // Check if any mentioned user is AFK
    const mentionedUsers = message.mentions.users;
    if (mentionedUsers.size > 0) {
        mentionedUsers.forEach(async (user) => {
            if (afkUsers[user.id]) {
                const afkInfo = afkUsers[user.id];
                await message.reply(`${user.username} is currently AFK: ${afkInfo.message}`);
            }
        });
    }
});

// Handle button interaction for getting CAPTCHA
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'get_captcha') {
        const userId = interaction.user.id;

        // Generate a new random CAPTCHA
        const newCaptcha = generateCaptcha(6);
        userCaptchas[userId] = newCaptcha; // Store the new CAPTCHA for the user

        // Create a modal for CAPTCHA input
        const modal = new ModalBuilder()
            .setCustomId('captcha_modal')
            .setTitle('CAPTCHA Verification');

        // Add a text input field for the CAPTCHA with a placeholder
        const captchaInput = new TextInputBuilder()
            .setCustomId('captcha_input')
            .setLabel('Enter CAPTCHA')
            .setPlaceholder(newCaptcha) // Show CAPTCHA in the placeholder
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(captchaInput);
        modal.addComponents(actionRow);

        // Show the modal to the user
        await interaction.showModal(modal);
    } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'captcha_modal') {
        const userId = interaction.user.id;
        const storedCaptcha = userCaptchas[userId];
        const enteredCaptcha = interaction.fields.getTextInputValue('captcha_input');

        if (enteredCaptcha === storedCaptcha) {
            const guild = interaction.guild;
            const roleId = captchas[guild.id]?.role;

            if (!roleId) {
                await interaction.reply({ content: 'No verification role has been set. Please inform the server admin.', ephemeral: true });
                return;
            }

            try {
                const member = await guild.members.fetch(userId);
                const role = guild.roles.cache.get(roleId);

                if (role) {
                    await member.roles.add(role);
                    await interaction.reply({ content: `CAPTCHA verified successfully! You have been assigned the role: **${role.name}**.`, ephemeral: true });
                } else {
                    await interaction.reply({ content: 'The verification role could not be found. Please contact the server admin.', ephemeral: true });
                }
            } catch (error) {
                console.error('Error assigning role:', error);
                await interaction.reply({ content: 'There was an error assigning the role. Please check my permissions and try again.', ephemeral: true });
            }

            // Remove the CAPTCHA after successful verification
            delete userCaptchas[userId];
        } else {
            await interaction.reply({ content: 'Incorrect CAPTCHA, please try again.', ephemeral: true });
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return; // Ensure it's a command

    const { commandName, options } = interaction;

    try {
        if (commandName === 'setup') {
            // Existing setup logic here...
        } else if (commandName === 'setembed') {
            // Existing setembed logic here...
        } else if (commandName === 'sendcaptcha') {
            // Existing sendcaptcha logic here...
        } else if (commandName === 'say') {
            const message = options.getString('message');
            const targetChannel = options.getChannel('channel');
            
            const channelToSend = targetChannel || interaction.channel;
            
            // Send the message to the specified channel (or the current one if not provided)
            await channelToSend.send(message);
            await interaction.reply({ content: 'Message sent!', ephemeral: true });
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (!interaction.replied) {
            await interaction.reply('There was an error while executing the command. Please try again.');
        }
    }
});

client.login(process.env.BOT_TOKEN);
