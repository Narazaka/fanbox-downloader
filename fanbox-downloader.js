let dlList = {items: {}, postCount: 0, fileCount: 0, id: 'undefined'};
let limit = 0;
let isIgnoreFree = false;

// 投稿の情報を個別に取得しない（基本true）
let isEco = true;

async function main() {
    if (window.location.origin === "https://downloads.fanbox.cc") {
        document.body.innerHTML = "";
        let tb = document.createElement("input");
        tb.type = "text";
        let bt = document.createElement("input");
        bt.type = "button";
        bt.value = "ok";
        document.body.appendChild(tb);
        document.body.appendChild(bt);
        bt.onclick = function () {
            downloadZip(tb.value).then(() => {
            });
        };
        return;
    } else if (window.location.origin === "https://www.fanbox.cc") {
        const userId = window.location.href.match(/fanbox.cc\/@(.*)/)[1];
        if (userId == null) {
            alert("しらないURL");
            return;
        }
        dlList.id = userId;
        const postId = window.location.href.match(/fanbox.cc\/@.*\/posts\/(\d*)/);
        if (postId) addByPostInfo(getPostInfoById(postId[1]));
        else await getItemsById(userId);
    } else if (window.location.href.match(/^https:\/\/(.*)\.fanbox\.cc\//)) {
        const userId = window.location.href.match(/^https:\/\/(.*)\.fanbox\.cc\//)[1];
        const postId = window.location.href.match(/.*\.fanbox\.cc\/posts\/(\d*)/);
        dlList.id = userId;
        if (postId) addByPostInfo(getPostInfoById(postId[1]));
        else await getItemsById(userId);
    } else {
        alert(`ここどこですか(${window.location.href})`);
        return;
    }
    const json = JSON.stringify(dlList);
    console.log(json);
    await navigator.clipboard.writeText(json);
    alert("jsonをコピーしました。downloads.fanbox.ccで実行して貼り付けてね");
}

// 投稿リストURLからURLリストに追加
function addByPostListUrl(url, eco) {
    const postList = JSON.parse(fetchUrl(url));
    const items = postList.body.items;

    console.log("投稿の数:" + items.length);
    for (let i = 0; i < items.length && limit !== 0; i++) {
        dlList.postCount++;
        // ecoがtrueならpostInfoを個別に取得しない
        if (eco === true) {
            console.log(items[i]);
            addByPostInfo(items[i]);
        } else {
            addByPostInfo(getPostInfoById(items[i].id));
        }
    }
    return postList.body.nextUrl;
}

// HTTP GETするおまじない
function fetchUrl(url) {
    const request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.withCredentials = true;
    request.send(null);
    return request.responseText;
}

// 投稿IDからitemsを得る
async function getItemsById(postId) {
    dlList.items = {};
    isIgnoreFree = confirm("無料コンテンツを省く？");

    limit = prompt("取得制限数を入力 キャンセルで全て取得");
    let count = 1, nextUrl;
    nextUrl = `https://api.fanbox.cc/post.listCreator?creatorId=${postId}&limit=100`;
    for (; nextUrl != null; count++) {
        console.log(count + "回目");
        nextUrl = addByPostListUrl(nextUrl, isEco);
        await setTimeout(() => {
        }, 100);
    }
}

// 投稿IDからpostInfoを得る
function getPostInfoById(postId) {
    return JSON.parse(fetchUrl(`https://api.fanbox.cc/post.info?postId=${postId}`)).body;
}

// postInfoオブジェクトからURLリストに追加する
function addByPostInfo(postInfo) {
    const title = postInfo.title;
    const date = postInfo.publishedDatetime;
    if (isIgnoreFree && (postInfo.feeRequired === 0)) {
        return;
    }

    if (postInfo.body == null) {
        console.log(`取得できませんでした(支援がたりない？)\nfeeRequired: ${postInfo.feeRequired}@${postInfo.id}`);
        return;
    }

    if (postInfo.type === "image") {
        const images = postInfo.body.images;
        for (let i = 0; i < images.length; i++) {
            addUrl(title, images[i].originalUrl, `${date} ${title} ${i + 1}.${images[i].extension}`);
        }
    } else if (postInfo.type === "file") {
        const files = postInfo.body.files;
        for (let i = 0; i < files.length; i++) {
            addUrl(title, files[i].url, `${date} ${title} ${files[i].name}.${files[i].extension}`);
        }
    } else if (postInfo.type === "article") {
        const imageMap = postInfo.body.imageMap;
        const imageMapKeys = Object.keys(imageMap);
        for (let i = 0; i < imageMapKeys.length; i++) {
            addUrl(title, imageMap[imageMapKeys[i]].originalUrl, `${date} ${title} ${i + 1}.${imageMap[imageMapKeys[i]].extension}`);
        }

        const fileMap = postInfo.body.fileMap;
        const fileMapKeys = Object.keys(fileMap);
        for (let i = 0; i < fileMapKeys.length; i++) {
            addUrl(title, fileMap[fileMapKeys[i]].url, `${date} ${title} ${fileMap[fileMapKeys[i]].name}.${fileMap[fileMapKeys[i]].extension}`);
        }
    } else {
        console.log(`不明なタイプ\n${postInfo.type}@${postInfo.id}`);
    }
    if (limit != null) limit--;
}

// URLリストに追加
function addUrl(title, url, filename) {
    const dl = {url: url, filename: filename};
    dlList.fileCount++;
    if (!dlList.items[title]) dlList.items[title] = [];
    dlList.items[title].push(dl);
}

// ZIPでダウンロード
async function downloadZip(json) {
    await import("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.6.0/jszip.min.js");
    dlList = JSON.parse(json);
    let zip = new JSZip();
    let root = zip.folder(dlList.id);
    for (const [title, items] of Object.entries(dlList.items)) {
        let folder = root.folder(title);
        for (const dl of items) {
            console.log(`download ${dl.filename}`)
            const response = await fetch(dl.url);
            const blob = await response.blob();
            folder.file(dl.filename, blob)
            await setTimeout(() => {
            }, 100);
        }
    }
    console.log("ZIPを作成");
    const blob = await zip.generateAsync({type: 'blob'});
    const url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = `${dlList.id}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    await setTimeout(() => window.URL.revokeObjectURL(url), 100);
}

await main();

