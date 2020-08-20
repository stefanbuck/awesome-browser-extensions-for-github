const fs = require('fs');

const readme = fs.readFileSync('./README.md').toString();
const data = require('./data.json');

const listSorted = data.sort((a, b) => {
    if (a.name < b.name) { return -1; }
    if (a.name > b.name) { return 1; }
    return 0;
})

const [intro] = readme.split('-->');

const markdownList = listSorted.map(item => {
    const browserIcons = Object.entries(item.store).map(([browserType, storeLink]) => {
        return `<a href="${storeLink}"><img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/${browserType}/${browserType}_48x48.png" width="24" /></a>`
    }).join(' ')

    return `### [${item.name}](${item.source || item.website}) ${browserIcons}

${item.description}

Installs: ${item.installCount || 'n/a'} | Stars: ${item.stars || 'n/a'} | Last update: ${item.lastUpdate || 'n/a'}`
}).join('\n\n');

fs.writeFileSync('./README.md', [`${intro}-->\n`, markdownList].join('\n'))