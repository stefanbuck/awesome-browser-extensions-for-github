const fs = require('fs');
const { format } = require('date-fns');
const got = require('got');
const graphqlGot = require('graphql-got');

const readme = require('./data.json')

const allExtensions = readme.map(item => {
    if (!item.source || !item.source.includes('https://github.com')) {
        return
    }
    return {
        name: item.name,
        url: item.source,
    }
}).filter(Boolean);

function getQuery(alias, owner, name) {
    return `repo${alias}: repository(owner:"${owner}" name:"${name}") {
        url,
        isArchived,
        stargazers {
            totalCount
        }
    }`
}

function getGraphqlQuery(list) {
    const innerQuery = list.map(({ name, url }, index) => {
        const [, , , owner, repo] = url.split('/');

        return getQuery(index, owner, repo)
    }).join('\n')

    return `query { ${innerQuery} }`
}

async function updateGitHubStats() {
    const result = await graphqlGot('https://api.github.com/graphql', {
        query: getGraphqlQuery(allExtensions),
        token: process.env.GITHUB_TOKEN,
    })

    Object.values(result.body).forEach((data) => {
        const it = readme.find((item) => {
            if (!item.source) {
                return false;
            }
            return item.source.includes(data.url)
        })
        if (it) {
            it.stars = data.stargazers.totalCount;
        }
    })
}


async function downloadStats(regexDownloads, regexVersion, storeUrl) {
    const ret = {
        download: 0,
        lastUpdate: '',
    }

    if (storeUrl.startsWith('https://github.com')) {
        return ret;
    }

    const res = await got.get(storeUrl, {
        headers: {
            'accept-language': 'en,en-US',
        }
    })
    const matchesDownloads = regexDownloads.exec(res.body);
    if (matchesDownloads && matchesDownloads[1]) {
        ret.download = parseInt(matchesDownloads[1].replace(/[.,]/g, ''), 10)
    }

    if (regexVersion) {
        const matchesVersion = regexVersion.exec(res.body);
        if (matchesVersion && matchesVersion[1]) {
            ret.lastUpdate = format(new Date(matchesVersion[1]), 'd MMM yyyy')
        }
    }

    return ret;
}

async function chromeStats(storeUrl) {
    return downloadStats(/content=\"UserDownloads:([0-9,]+)/, /h-C-b-p-D-xh-hh">([^<]+)/, storeUrl)
}
async function firefoxStats(storeUrl) {
    return downloadStats(/average_daily_users":([0-9,]+)/, /AddonMoreInfo-last-updated">[^(]+\(([^)]+)/, storeUrl)
}
async function operaStats(storeUrl) {
    return downloadStats(/Downloads<\/dt><dd>([0-9,]+)/, '', storeUrl)
}

async function updateDownloadStats(itemIndex) {
    const item = readme[itemIndex - 1];

    if (!item) {
        return Promise.resolve()
    }

    let installCount = 0;
    let lastUpdate = '';

    if (item.store.chrome) {
        try {

            const res = await chromeStats(item.store.chrome)
            console.log('chrome', res.download);
            if (res.download) installCount += res.download;
            if (!lastUpdate) lastUpdate = res.lastUpdate;
        } catch (error) {
            console.log('chrome', error);
        }
    }
    if (item.store.firefox) {
        try {
            const res = await firefoxStats(item.store.firefox)
            if (res.download) installCount += res.download;
            console.log('firefox', res.download);
            if (!lastUpdate) lastUpdate = res.lastUpdate;
        } catch (error) {
            console.log('firefox', error);
        }
    }
    if (item.store.opera) {
        try {

            const res = await operaStats(item.store.opera)
            if (res.download) installCount += res.download;
            console.log('opera', res.download);
        } catch (error) {
            console.log('opera', error);
        }
    }

    if (installCount) item.installCount = installCount;
    if (lastUpdate) item.lastUpdate = lastUpdate;

    console.log(item.name, lastUpdate, installCount)

    return updateDownloadStats(itemIndex - 1)
}

async function init() {
    await updateGitHubStats();
    await updateDownloadStats(readme.length);
    fs.writeFileSync('data.json', JSON.stringify(readme, null, '  '));
}

init();