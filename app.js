const express = require('express');
const request = require('request');
const sendgrid = require('@sendgrid/mail');

const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.login('MTA3MTEwNDUxMjA4NzA0ODIzMg.GYZC9r.IskNzR3InA1e-Ob2lleD5EaL3eXpgohYLIKTGE');

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
sendgrid.setApiKey(SENDGRID_API_KEY);
const port = process.env.PORT || 3001;

const app = express();

let msg = {
  from: 'rorystandley@gmail.com',
  to: ['rorystandley@gmail.com', 'watson.jake1996@gmail.com'],
  subject: 'War Day Results',
}

const getRequestOptions = (url) => ({
  'method': 'GET',
  'url': `https://proxy.royaleapi.dev/v1/${url}`,
  'headers': {
    'Authorization': `Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjllNDRjZDJjLWMzMzEtNDk4ZC1hZWVjLTNiODhmODllZmEyOCIsImlhdCI6MTY1OTk2ODEwMCwic3ViIjoiZGV2ZWxvcGVyLzFlMTExZWJlLWRmZjYtMjEwYy0zYWI0LTBhMjNiY2U4NTQyZCIsInNjb3BlcyI6WyJyb3lhbGUiXSwibGltaXRzIjpbeyJ0aWVyIjoiZGV2ZWxvcGVyL3NpbHZlciIsInR5cGUiOiJ0aHJvdHRsaW5nIn0seyJjaWRycyI6WyI0NS43OS4yMTguNzkiXSwidHlwZSI6ImNsaWVudCJ9XX0.LsVuAZNI0JHfOVbBldPw7cMTcMne0Ggu06-RRuwGCovCuyg8xN7naQVkqH4h_aDFnBQM2vgc1vMHv-R1HybgWg`
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

function generateHtmlTable(data) {
  let html = "<table border='1' style='width:100%; border-collapse: collapse;'>";
  html += "<tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr>"
  data.forEach((element) => {
    html += "<tr>";
    html += "<td style='text-align:center'>";
    html += element.column1;
    html += "</td>";
    html += "<td style='text-align:center'>";
    html += element.column2;
    html += "</td>";
    html += "<td style='text-align:center'>";
    html += element.column3;
    html += "</td>";
    html += "</tr>";
  });
  html += "</table>"
  return html;
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
    // msg.html = html;
    // sendgrid.send(msg);
    res.status(200).send("Report sent.");
  } catch (err) {
    console.log(err);
    res.status(500).send("An error occured.");
  }

});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));