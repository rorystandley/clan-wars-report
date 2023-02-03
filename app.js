const express = require('express');
const request = require('request');
const sendgrid = require('@sendgrid/mail');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
sendgrid.setApiKey(SENDGRID_API_KEY);
const port = process.env.PORT || 3001;

const app = express();

let msg = {
  from: 'rorystandley@gmail.com',
  to: ['rorystandley@gmail.com'],
  subject: 'War Day Results',
}

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
    const html = generateHtmlTable(data);
    msg.html = html;
    sendgrid.send(msg);
    res.status(200).send("Email sent.");
  } catch (err) {
    console.log(err);
    res.status(500).send("An error occured.");
  }

});

function generateHtmlTable(data) {
  let html = "<table border='1' style='width:100%; border-collapse: collapse;'>";
  html += "<tr><th>Position</th><th>Name</th><th>Fame</th><th>Repair Points</th><th>Boat Attacks</th><th>Decks Used Today</th></tr>"
  let counter = 0;
  data.forEach((element) => {
    html += "<tr>";
    html += "<td style='text-align:center'>";
    html += parseInt(data.length) - parseInt(counter);
    html += "</td>";
    html += "<td style='padding-left: 10px;'>";
    html += element.name;
    html += "</td>";
    html += "<td style='text-align:center'>";
    html += element.fame;
    html += "</td>";
    html += "<td style='text-align:center'>";
    html += element.repairPoints;
    html += "</td>";
    html += "<td style='text-align:center'>";
    html += element.boatAttacks;
    html += "</td>";
    html += "<td style='text-align:center' ";
    if (element.decksUsedToday < 4) {
      html += "background-color: red; color: white;'";
    }
    html += ">";
    html += element.decksUsedToday;
    html += "</td>";
    html += "</tr>";
    counter++;
  });
  html += "</table>"
  return html;
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`));