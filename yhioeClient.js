const querystring = require('querystring');
const https = require("https");
var crypto = require('crypto');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const authpost = (host, port, path, cookie, data) => {
    var postData = querystring.stringify(data);
    var options = {
        hostname: host,
        port: port,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length,
            'User-Agent': 'UNpkl/1',
            'Cookie': cookie,
            'Connection': 'Keep-Alive'
        }
    };
    var req = https.request(options, (res) => {
        // console.log('statusCode:', res.statusCode);
        // console.log('headers:', res.headers);
        res.on('data', (d) => {
            //process.stdout.write(d);
        });
    });
    req.write(postData);
    req.on('error', (e) => {
        console.error(e);
    });
    req.end();
};

function getObjectIfValidJson(str) {
    var obj = null;
    try {
        obj = JSON.parse(str);
    } catch (e) {
        return null;
    }
    return obj;
}

function yhioeRmPunct(s, replaceChar) {
    var orig = s.toString();
    return orig.replace(/[.,\/#!$%\^&\*;:{}=\-_`~() ]/g,
        replaceChar).replace(/\s{2,}/g, replaceChar);
}

function yhioeGetConntrackIndx(row) {
    return yhioeRmPunct(row.ip4sstr, "_") + '__' +
        row.sport + '__' +
        yhioeRmPunct(row.ip4dstr, "_") + '__' +
        row.dport;
}

/*
    { conntrackKey: row, conntrackKey1: row }
 */
var yhioeLiveData = {
    listOfRecords: [],
    jsonData: '',
    yhioeConntrackObj: {},
    yhioeAcctByTag: {},
    yhioeAcctBySite: {},
    yhioeAcctByUsr: {},
    yhAcctStats: {},
    yhioeConnCt: {byUser: {}, global: {}},
    yhErrors: []
};

var yhioeDefaultTags = {
    facebook: 'social media',
    instagram: 'social media',
    youtube: 'internet video',
    ytimg: 'internet video',
    reddit: 'social media',
    cnn: 'news',
    foxnews: 'news',
    amazon: 'shopping',
    hulu: 'internet video',
    netflix: 'internet video',
    nflx: 'internet video',
    snapchat: 'social media',
    amazonvideo: 'internet video'
}

function yhioeTokenizeDest(row) {
    var rowcopy = {...row};
    if (!rowcopy.dstname.length) {
        return rowcopy;
    }
    let toks = rowcopy.dstname.split('.');
    for (var j = toks.length - 3, i = 1; j >= 0; j--, i++) {
        rowcopy['t' + i] = toks[j];
        if (yhioeDefaultTags.hasOwnProperty(toks[j])) {
            rowcopy.tag = yhioeDefaultTags[toks[j]];
        }
    }
    return rowcopy;
}

function yhioeDnsTokenAcctHelper(parentObject, ctrow) {
    var row = yhioeTokenizeDest(ctrow);
    if (row.hasOwnProperty('tag')) {
        let tag = yhioeRmPunct(row.tag, '_');
        if (parentObject.yhioeAcctByTag.hasOwnProperty(tag)) {
            parentObject.yhioeAcctByTag[tag].time_spent +=
                row.time_spent;
        } else {
            parentObject.yhioeAcctByTag[tag] = {};
            parentObject.yhioeAcctByTag[tag].time_spent =
                row.time_spent;
        }
    }

    if (row.hasOwnProperty('t1')) {
        if (parentObject.yhioeAcctBySite.hasOwnProperty(row.t1)) {
            parentObject.yhioeAcctBySite[row.t1].time_spent +=
                row.time_spent;
        } else {
            parentObject.yhioeAcctBySite[row.t1] = {};
            parentObject.yhioeAcctBySite[row.t1].time_spent =
                row.time_spent;
        }
    }
    /*
    if (row.hasOwnProperty('t2')) {
        if (parentObject.yhioeAcctBySite.hasOwnProperty(row.t2)) {
            parentObject.yhioeAcctBySite[row.t2].time_spent +=
                row.time_spent;
        } else {
            parentObject.yhioeAcctBySite[row.t2] = {};
            parentObject.yhioeAcctBySite[row.t2].time_spent =
                row.time_spent;
        }
    }
    if (row.hasOwnProperty('t3')) {
        if (parentObject.yhioeAcctBySite.hasOwnProperty(row.t3)) {
            parentObject.yhioeAcctBySite[row.t3].time_spent +=
                row.time_spent;
        } else {
            parentObject.yhioeAcctBySite[row.t3] = {};
            parentObject.yhioeAcctBySite[row.t3].time_spent =
                row.time_spent;
        }
    }
    */
}

function yhioeGetSrcKey(row) {
    return row.ip4sstr + '__' + row.srcname;
}

function yhioeDnsTokenAcct(row) {
    var parentObject = yhioeLiveData;
    let srckey = yhioeGetSrcKey(row);
    yhioeDnsTokenAcctHelper(parentObject, row);
    if (yhioeLiveData.yhioeAcctByUsr.hasOwnProperty(srckey)) {
        parentObject = yhioeLiveData.yhioeAcctByUsr[srckey];
    } else {
        yhioeLiveData.yhioeAcctByUsr[srckey] = {};
        yhioeLiveData.yhioeAcctByUsr[srckey].yhioeAcctBySite = {};
        yhioeLiveData.yhioeAcctByUsr[srckey].yhioeAcctByTag = {};
        parentObject = yhioeLiveData.yhioeAcctByUsr[srckey];
    }
    /* per user accounting */
    yhioeDnsTokenAcctHelper(parentObject, row);
}

function yhioeAcctCounts(parentObject, usr) {
    var sites_list = [];
    var tags_list = [];
    for (const site in parentObject.yhioeAcctBySite) {
        sites_list.push({
            site: site,
            time_spent: parentObject.yhioeAcctBySite[site].time_spent
        });
    }
    for (const tag in parentObject.yhioeAcctByTag) {
        tags_list.push({
            tag: tag,
            time_spent: parentObject.yhioeAcctByTag[tag].time_spent
        });
    }
    sites_list.sort((a, b) =>
        (a.time_spent > b.time_spent) ? 1 : -1);
    tags_list.sort((a, b) =>
        (a.time_spent > b.time_spent) ? 1 : -1);
    var site_list_names = [];
    var site_list_values = [];
    var tag_list_names = [];
    var tag_list_values = [];
    for (let i = sites_list.length - 1; i >= 0; i--) {
        let sorted_site = sites_list[i];
        site_list_names.push(sorted_site.site);
        site_list_values.push(sorted_site.time_spent);
    }
    for (let i = tags_list.length - 1; i >= 0; i--) {
        let sorted_tag = tags_list[i];
        tag_list_names.push(sorted_tag.tag);
        tag_list_values.push(sorted_tag.time_spent);
    }
    return {
        acct: {
            bySite: {"sites": site_list_names, "time_spent": site_list_values},
            byTag: {"tags": tag_list_names, "time_spent": tag_list_values}
        }
    };
}

function yhioeRunAcctStats() {
    yhioeLiveData.yhAcctStats.byUser = {};
    for (const usr in yhioeLiveData.yhioeAcctByUsr) {
        let usrAcct = yhioeAcctCounts(yhioeLiveData, usr);
        yhioeLiveData.yhAcctStats.byUser[usr] = usrAcct;
    }
    yhioeLiveData.yhAcctStats.global =
        yhioeAcctCounts(yhioeLiveData);

    /*
      After this call the foll should be set:
      yhioeLiveData.yhAcctStats.byUser[usr].acct.bySite
      yhioeLiveData.yhAcctStats.byUser[usr].acct.byTag
      yhioeLiveData.yhAcctStats.global.acct.bySite
      yhioeLiveData.yhAcctStats.global.acct.byTag
     */

}

function yhioeRollingTableData(jsondata) {
    yhioeLiveData.jsonData += jsondata;
    let beg = yhioeLiveData.jsonData.indexOf('[');
    let end = yhioeLiveData.jsonData.indexOf(']');
    if (beg >= 0 && end > 0 && end > beg) {
        let fullObjJson = yhioeLiveData.jsonData.substring(beg, end + 1);
        let remaining = yhioeLiveData.jsonData.substring(end + 1);
        let obj = getObjectIfValidJson(fullObjJson);
        if (obj) {
            // console.log(fullObjJson);
            yhioeLiveData.listOfRecords.push(obj);
            yhioeLiveData.jsonData = remaining;
        } else {
            // console.log("bad data");
            // console.log(fullObjJson);
            return;
        }
    } else {
        // console.log("incomplate");
        // console.log(yhioeLiveData.jsonData);
        return;
    }
    let rows = yhioeLiveData.listOfRecords.pop();
    var tot_time = 0;

    // var tot = 0;
    // var st = '';
    // for (const obj in yhioeLiveData.yhioeConntrackObj) {
    //     st = st + obj + ' ';
    //     tot++;
    // }

    for (var i = 0; i < rows.length; i++) {
        let row = rows[i];
        if (row.hasOwnProperty('ctid')) {
            var conntrackKey = yhioeGetConntrackIndx(row);
            var srcKey = row.ip4sstr;
            var increment_by =
                yhioeLiveData.yhioeConntrackObj.hasOwnProperty(conntrackKey)? 0 : 1;
            switch (row.op) {
                case 'insert':
                    yhioeLiveData.yhioeConntrackObj[conntrackKey] = row;
                    if (!yhioeLiveData.yhioeConnCt.byUser.hasOwnProperty(srcKey)) {
                        yhioeLiveData.yhioeConnCt.byUser[srcKey] = {count: 1};
                    } else {
                        yhioeLiveData.yhioeConnCt.byUser[srcKey].count += increment_by;
                    }
                     if (!yhioeLiveData.yhioeConnCt.global.hasOwnProperty('count')) {
                         yhioeLiveData.yhioeConnCt.global['count'] = 1;
                     } else {
                         yhioeLiveData.yhioeConnCt.global['count'] += increment_by;
                     }
                    yhioeDnsTokenAcct(row);
                    break;
                case 'update':
                    yhioeDnsTokenAcct(row);
                    break;
                case 'delete':
                    /* we may be observing when connections are going down */
                    if (yhioeLiveData.yhioeConnCt.byUser.hasOwnProperty(srcKey)
                        && increment_by == 0) {
                        yhioeLiveData.yhioeConnCt.byUser[srcKey].count -= 1;
                        if (yhioeLiveData.yhioeConnCt.byUser[srcKey].count < 0) {
                            yhioeLiveData.yhioeConnCt.byUser[srcKey].count = 0;
                        }
                    }
                    if (yhioeLiveData.yhioeConnCt.global.hasOwnProperty('count') &&
                        increment_by == 0) {
                        yhioeLiveData.yhioeConnCt.global['count'] -= 1;
                        if (yhioeLiveData.yhioeConnCt.global['count'] < 0) {
                            yhioeLiveData.yhioeConnCt.global['count'] = 0;
                        }
                    }
                    if (increment_by == 0) {
                        delete yhioeLiveData.yhioeConntrackObj[conntrackKey];
                    } else {
                        yhioeLiveData.yhErrors.push('key ' + conntrackKey + ' not found');
                    }
                    break;
            }
            // console.log(JSON.stringify(yhioeLiveData.yhioeConntrackObj,
            //     null, 2));
        }
    }
}

const authGet = (host, port, path, cookie) => {
    var options = {
        hostname: host,
        port: port,
        path: path,
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'UNpkl/1',
            'Cookie': cookie,
            'Connection': 'Keep-Alive'
        }
    };
    var req = https.request(options, (res) => {
        // console.log('statusCode:', res.statusCode);
        // console.log('headers:', res.headers);
        var data = '';
        res.on('data', (d) => {
            var x = d.toString();
            // console.log('rawdata');
            console.log(x);
            // yhioeRollingTableData(x);
        })
    });
    req.on('error', (e) => {
        console.error(e);
    });
    req.end();
};

const authFetch = (host, port, path, credentials, data) => {
    var cookie = credentials.cookie;
    delete credentials.cookie;
    var postData = querystring.stringify({...credentials});
    var options = {
        hostname: host,
        port: port,
        path: '/',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length,
            'User-Agent': 'UNpkl/1',
            'Cookie': cookie,
            'Connection': 'Keep-Alive'
        }
    };
    /* At first, authenticate */
    var req = https.request(options, (res) => {
        // console.log('statusCode:', res.statusCode);
        // console.log('headers:', res.headers);
        if (res.statusCode >= 200 && res.statusCode < 400) {
            res.on('data', (d) => {
                /* If we have dem cookies and things went well
                 * at auth getCookies and send get or post
                 * Cloud sends us a modified cookie
                 * to indicate owner.
                 */
                var newcookie = cookie;
                if (newcookie.indexOf('session=') >= 0) {
                    newcookie = getCookies(res);
                }
                // console.log("cookie: " + newcookie);
                // process.stdout.write(d);
                // process.stdout.write('\n');
                if (data) {
                    return authpost(host, port, path, newcookie, data);
                } else {
                    return authGet(host, port, path, newcookie);
                }
            });
        } else {
            res.on('data', (d) => {
                // console.log('authFetch error: ' + d);
            });
        }
    });
    req.write(postData);
    req.on('error', (e) => {
        console.error(e);
    });
    req.end();
};

const getCookies = (res) => {
    var cook = [];
    for (var i = 0; i < res.headers['set-cookie'].length; i++) {
        var cookie =  res.headers['set-cookie'][i];
        var cookie_str = cookie.slice(0, cookie.indexOf(';'));
        cook.push(cookie_str);
    }
    return cook.join('; ');
};

const authenticateAndFetch = (host, port, path, credentials, postdata) => {
    var options = {
        hostname: host,
        port: port,
        path: '/',
        method: 'GET',
        headers: {'User-Agent': 'UNpkl/1'}
    };
    var req = https.request(options, (res) => {
        // console.log('statusCode:', res.statusCode);
        // console.log('headers:', res.headers);
        if (res.headers['set-cookie'].length) {
            credentials = {
                ...credentials,
                cookie: getCookies(res)
            };
            return authFetch(host, port, path, credentials, postdata);
        }
    });

    req.on('error', (e) => {
        console.error(e);
    });
    req.end();
};

const testYhioeEndpoint = (host, port, endpoint, credentials, postdata) => {
    authenticateAndFetch(host, port, endpoint, credentials, postdata);
};

exports.testYhioeEndpoint = testYhioeEndpoint;
