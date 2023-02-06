const express = require('express');
const request = require('request');

const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.login(process.env.DISCORD_BOT);

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

const port = process.env.PORT || 3001;
const app = express();

const getRequestOptions = (url) => ({
  'method': 'GET',
  'url': `https://proxy.royaleapi.dev/v1/${url}`,
  'headers': {
    'Authorization': `Bearer ${process.env.CLASH_ROYALE_BEARER_TOKEN}`
  }
});

async function getRiverRaceData() {
  try {
    const clanData = await request(getRequestOptions('clans/%232L8CYUP/currentriverrace'));
    const clanDataString = await new Promise((resolve, reject) => {
      let data = '';
      clanData.on('data', chunk => {
        data += chunk;
      });
      clanData.on('end', () => {
        resolve(data);
      });
      clanData.on('error', error => {
        reject(error);
      });
    });
    const clanDataJSON = JSON.parse(clanDataString);
    const currentClanMembers = [];
    const requests = clanDataJSON.clan.participants.map((participant, index) => {
      return new Promise(async (resolve, reject) => {
        await setTimeout(async () => {
          request(getRequestOptions(`players/${encodeURIComponent(participant.tag)}`))
            .on('response', (response) => {
              let data = '';
              response.on('data', dataChunk => {
                data += dataChunk;
              });
              response.on('end', () => {
                resolve(data);
              });
            })
            .on('error', error => {
              reject(error);
            });
        }, 500 * index);
      });
    });
    const additionalData = await Promise.all(requests);
    additionalData.forEach((data, i) => {
      const participantDataJSON = JSON.parse(data);
      const participantExists = participantDataJSON.clan && participantDataJSON.clan.tag === '#2L8CYUP';
      if (participantExists) {
        currentClanMembers.push(clanDataJSON.clan.participants[i]);
      }
    });
    return currentClanMembers;
  } catch (error) {
    console.error(error);
    return [];
  }
}

app.get('/:id?', async (req, res) => {
  if (!req.params.id || req.params.id !== "rory") {
    return res.status(400).send("Invalid request.");
  }

  try {
    const data = await getRiverRaceData();
    // const html = generateHtmlTable(data);
    const channel = client.channels.cache.get('985966805652746253');
    if (channel) {
      let msg = "The following players did not use all their war decks in yesterdays war:\n\n";
      let count = 0;
      data.forEach((element) => {
        if (element.decksUsedToday <= 3) {
          msg += `* ${element.name} - Decks used: ${element.decksUsedToday}\n`;
          count++;
        }
      })
      if (count === 0) {
        msg = "All players used all their war decks in yesterdays war."
      }
      channel.send(msg);
    }
    res.status(200).send("Report sent.");
  } catch (err) {
    console.log(err);
    res.status(500).send("An error occured.");
  }

});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));