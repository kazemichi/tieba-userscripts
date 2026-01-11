// ==UserScript==
// @name         取消收藏贴吧收藏夹中已删除的帖子
// @namespace    https://github.com/
// @version      1.1.0-250805
// @description  点击自动删除
// @author       kazemichi
// @match        https://tieba.baidu.com/i/i/storethread*
// @icon         https://files.codelife.cc/website/tieba.svg
// @grant        GM_info
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      tieba.baidu.com
// @license      MIT
// ==/UserScript==
/* globals PageData, waitForKeyElements */

(function() {
    'use strict';

    /**
     * 显示通知
     * @param {String} text 通知内容
     */
    const showNotification = (text) => {
        GM_notification({
            title: GM_info.script.name,
            image: GM_info.script.icon,
            text,
            timeout: 3000
        });
    };

    /**
     * 获取页面内容
     * @param {number} pageNum 页码
     * @returns {Promise<Document>}
     */
    const getPageContent = (pageNum) => new Promise((resolve, reject) => {
        const pageUrl = `https://tieba.baidu.com/i/i/storethread?&pn=${pageNum}&tag=`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: pageUrl,
            onload: (xhr) => {
                if (xhr.status === 200) {
                    const doc = new DOMParser().parseFromString(xhr.responseText, 'text/html');
                    resolve(doc);
                } else {
                    reject(new Error(`获取第 ${pageNum} 页失败，状态码: ${xhr.status}`));
                }
            },
            onerror: () => reject(new Error(`网络请求失败: ${pageUrl}`))
        });
    });

    /**
     * 删除帖子
     * @param {string} tid 帖子 ID
     * @returns {Promise<void>}
     */
    const deleteThread = (tid) => new Promise((resolve) => {
        const data = new URLSearchParams({
            tbs: PageData.tbs,
            tid,
            type: 0,
            datatype: 'json',
            ie: 'utf-8'
        }).toString();

        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://tieba.baidu.com/i/submit/cancel_storethread',
            data,
            responseType: 'json',
            onload: (xhr) => {
                if (xhr.response?.is_done) {
                    console.log(`${tid} 删除成功`);
                    resolve();
                } else {
                    console.warn(`${tid} 删除失败`, xhr.response);
                    resolve(); // 即使失败也继续流程
                }
            },
            onerror: () => {
                console.error(`${tid} 请求失败`);
                resolve();
            }
        });
    });

    /**
     * 并发控制器
     * @param {Array} items 任务数组
     * @param {Function} worker 异步任务函数
     * @param {number} concurrency 并发数量
     * @returns {Promise<void>}
     */
    const runConcurrently = (items, worker, concurrency = 5) => {
        let index = 0;
        let running = 0;
        let completed = 0;
        const total = items.length;

        return new Promise((resolve) => {
            const runNext = () => {
                while (running < concurrency && index < total) {
                    const item = items[index++];
                    running++;
                    
                    worker(item).finally(() => {
                        running--;
                        completed++;
                        if (completed === total) resolve();
                        if (running < concurrency) runNext();
                    });
                }
            };

            runNext();
        });
    };

    /**
     * 开始执行任务
     */
    const startTask = async () => {
        try {
            const tidList = [];
            let pageNum = 1;
            let hasMore = true;

            showNotification('开始扫描收藏帖子...');

            while (hasMore) {
                const doc = await getPageContent(pageNum).catch(console.error);
                if (!doc) break;

                const threadList = doc.querySelector('.feed')?.querySelectorAll('li.feed_item');
                if (!threadList || threadList.length === 0) break;

                threadList.forEach(item => {
                    const deletedBtn = item.querySelector('a.j_del_kept');
                    if (deletedBtn) {
                        const triData = item.querySelector('.p_favth_tri')?.dataset?.field;
                        if (triData) {
                            try {
                                tidList.push(JSON.parse(triData).tid);
                            } catch (e) {
                                console.warn('解析 triData 失败', e);
                            }
                        }
                    }
                });

                hasMore = threadList.length > 0;
                pageNum++;
            }

            if (tidList.length === 0) {
                showNotification('未找到可删除的帖子');
                return;
            }

            showNotification(`共找到 ${tidList.length} 个已删除帖子，开始取消收藏...`);

            // 使用并发控制执行删除
            await runConcurrently(tidList, deleteThread, 5);

            showNotification(`操作完成！已处理 ${tidList.length} 个帖子`);
        } catch (error) {
            console.error('任务执行失败:', error);
            showNotification('操作失败，请查看控制台');
        }
    };

    GM_registerMenuCommand('开始执行', startTask);
})();