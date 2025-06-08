// ==UserScript==
// @name         显示贴吧用户名
// @namespace    https://github.com/
// @version      1.0.1-250608
// @description  网页版贴吧显示楼层、楼中楼的贴吧用户名，以及楼中楼的“楼主”标识。
// @author       kazemichi
// @match        https://tieba.baidu.com/p/*
// @icon         https://files.codelife.cc/website/tieba.svg
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// @connect      tieba.baidu.com
// @license      MIT
// ==/UserScript==

(function() {
'use strict';

const USERNAME_STYLE = 'padding: 0 3px; color: #999; font-size: 12px; letter-spacing: normal;';

/**
 * 在楼层中显示用户名
 */
function displayFloorUsernames() {
    const authorNames = document.querySelectorAll('a.p_author_name.j_user_card:not(.processed)');

    authorNames.forEach(authorName => {
        authorName.classList.add('processed');
        const container = authorName.closest('li.d_name');
        if (!container || container.querySelector('.un-mark')) return;

        try {
            const attr = authorName.getAttribute('data-field');
            const { un: username } = JSON.parse(attr);
            if (!username) return;

            const usernameEl = document.createElement('p');
            usernameEl.className = 'un-mark';
            usernameEl.style.cssText = USERNAME_STYLE;
            usernameEl.textContent = `(${username})`;

            authorName.insertAdjacentElement('afterend', usernameEl);
        } catch (e) {
            console.error('用户名解析失败', e);
        }
    });
}

/**
 * 在楼中楼显示用户名 (不包含回复用户)
 */
function displayLzlUsernames() {
    const lzlNames = document.querySelectorAll('a.at.j_user_card:not(.processed)');

    lzlNames.forEach(lzlName => {
        lzlName.classList.add('processed');
        const container = lzlName.closest('div.lzl_cnt');
        if (!container || container.querySelector('.un-mark')) return;

        const username = lzlName.getAttribute('username');
        if (!username) return;

        const usernameEl = document.createElement('span');
        usernameEl.className = 'un-mark';
        usernameEl.style.cssText = USERNAME_STYLE;
        usernameEl.textContent = `(${username})`;

        lzlName.insertAdjacentElement('afterend', usernameEl);
    });
}

/**
 * 主执行函数
 */
function displayUsernames() {
    displayFloorUsernames();
    displayLzlUsernames();
}

// 初始化执行
displayUsernames();

// 设置观察器
const observerTarget = document.querySelector('#pb_content');
if (observerTarget) {
    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(displayUsernames, 100);
    });

    observer.observe(observerTarget, {
        childList: true,
        subtree: true
    });
}


/**
 * 添加“楼主”标识
 * @param {string} portrait data-field 的 id 字符串
 */
function addLouzhuMark(portrait) {
    GM_addStyle(`
        a.at.j_user_card[data-field*='${portrait}']:after,
        a.at.j_user_card[portrait='${portrait}']:after {
            content: '楼主';
            color: #6e7dc0;
            border: 1px solid #6e7dc0;
            border-radius: 5px;
            padding: 1px 5px;
            margin: 0 1px 0 5px;
            font-size: 12px;
        }
    `)
}

/**
 * 获取楼主 data-field 的 id
 */
function getLouzhuData() {
    let firstPageUrl = window.location.origin + window.location.pathname;
    GM_xmlhttpRequest({
        method: 'GET',
        url: firstPageUrl,
        onload: (xhr) => {
            if (xhr.status == 200) {
                let parser = new DOMParser(),
                    doc = parser.parseFromString(xhr.responseText, 'text/html'),
                    result = doc.querySelector('div.j_louzhubiaoshi')?.closest('div.d_author').querySelector('a.p_author_name').dataset.field;
                addLouzhuMark(JSON.parse(result).id.split('?')[0]);
            }
        }
    });
}

// 楼中楼显示“楼主”标识
getLouzhuData();
})();