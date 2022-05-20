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

    let res;
    try {
        res = await got.get(storeUrl, {
            headers: {
                'accept-language': 'en,en-US',
            }
        })
    } catch (error) {
        console.log(storeUrl)
        console.log(error)
        return ret;
    }

    const matchesDownloads = regexDownloads.exec(res.body);
    if (matchesDownloads && matchesDownloads[1]) {
        ret.download = parseInt(matchesDownloads[1].replace(/[.,]/g, ''), 10)
    }

    if (regexVersion) {
        const matchesVersion = regexVersion.exec(res.body);
        if (matchesVersion && matchesVersion[1]) {
            ret.lastUpdate = new Date(matchesVersion[1])
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

function findRecentVersion(dateList) {
    if (dateList.length === 0) {
        return 'n/a'
    }
    try {
        return format(new Date(Math.max(...dateList.filter(Boolean).map(a => new Date(a)))), 'd MMM yyyy');
    } catch (error) {
        return 'n/a'
    }
}

async function updateDownloadStats(itemIndex) {
    const item = readme[itemIndex - 1];

    if (!item) {
        return Promise.resolve()
    }

    let installCount = 0;
    const lastUpdates = [];

    if (item.store.chrome) {
        try {

            const res = await chromeStats(item.store.chrome)
            console.log('chrome', res.download);
            if (res.download) installCount += res.download;
            lastUpdates.push(res.lastUpdate);
        } catch (error) {
            console.log('chrome', error);
        }
    }
    if (item.store.firefox) {
        try {
            const res = await firefoxStats(item.store.firefox)
            if (res.download) installCount += res.download;
            console.log('firefox', res.download);
            lastUpdates.push(res.lastUpdate);
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
    item.lastUpdate = findRecentVersion(lastUpdates.filter(Boolean));

    console.log(item.name, item.lastUpdate, installCount)

    return updateDownloadStats(itemIndex - 1)
}

async function init() {
    await updateGitHubStats();
    await updateDownloadStats(readme.length);
    fs.writeFileSync('data.json', JSON.stringify(readme, null, '  '));
}

init();