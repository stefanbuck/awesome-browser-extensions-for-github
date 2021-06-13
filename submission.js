const fs = require('fs');
const data = require('./data.json')
const submission = require('./submission.json')

function removeEmptyKeys(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([key, value]) => !!value))
}

function cleanTags(arr) {
    return arr.filter(Boolean);
}

data.push(removeEmptyKeys({
    name: submission.name,
    description: submission.description,
    source: submission.source,
    tags: cleanTags([
        submission.code && 'code',
        submission.codereview && 'codereview',
        submission.comments && 'comments',
        submission.ide && 'ide',
        submission.miscellaneous && 'miscellaneous',
        submission.navigation && 'navigation',
        submission.newsfeed && 'newsfeed',
        submission.notifications && 'notifications',
        submission.profile && 'profile',
        submission.pull_request && 'pullrequest',
        submission.repository && 'repository',
        submission.search && 'search',
        submission.theme && 'theme',
    ]),
    store: removeEmptyKeys({
        chrome: submission.chrome,
        firefox: submission.firefox,
        edge: submission.edge,
        opera: submission.opera,
    })
}))

fs.writeFileSync('data.json', JSON.stringify(data, null, '  '))

