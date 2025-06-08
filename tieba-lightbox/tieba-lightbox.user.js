// ==UserScript==
// @name         灯箱展示贴吧图片
// @namespace    http://tampermonkey.net/
// @version      1.2.6-20250315
// @description  替代贴吧原本很丑的点击打开新标签页展示图像
// @author       kazemichi
// @match        https://tieba.baidu.com/p/*
// @icon         https://files.codelife.cc/website/tieba.svg
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_xmlhttpRequest
// @grant        window.onurlchange
// @require      https://cdnjs.cloudflare.com/ajax/libs/viewerjs/1.11.7/viewer.min.js
// @resource style https://cdnjs.cloudflare.com/ajax/libs/viewerjs/1.11.7/viewer.min.css
// @connect      tieba.baidu.com
// @license      MIT
// ==/UserScript==
/* globals Viewer, waitForKeyElements */

/**
 * Dependancies:
 * - Viewer.js: https://github.com/fengyuanchen/viewerjs
 */

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(GM_getResourceText('style'));

    // 常量正则表达式提升性能
    const REGEX_PIC_ID = /\/([a-f0-9]{40})\.jpg/i;
    const REGEX_TID = /\/p\/(\d+)/;

    // 工具栏图标设置
    const TOOLBAR_SETTING = {
        show: true,
        size: 'large'
    };

    /**
     * 获取展示图片的 URL
     * @param {string} src 当前点击图片的 src
     * @returns {string} 原图 waterurl 或缩小图 url
     */
    const getOriginalUrl = (src) => {
        return new Promise((resolve) => {
            const pic_id = src.match(REGEX_PIC_ID)[1], // 图片 id
                tid = location.href.match(REGEX_TID)[1]; // 帖子 id

            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://tieba.baidu.com/photo/p?tid=${tid}&pic_id=${pic_id}`,
                onload: (xhr) => {
                    if (xhr.status == 200) {
                        // 解析 JavaScript 变量提取图片信息对象
                        let albumDataMatch = xhr.responseText.match(/var albumData\s*=\s*({[\s\S]*?});/);
                        if (albumDataMatch) {
                            let albumData = JSON.parse(albumDataMatch[1].replace(/'/g, '"')),
                                targetUrl = albumData.img.original.waterurl || albumData.img.medium.url; // 优先获取 original 原图，否则获取 medium 缩小图
                            resolve(targetUrl);
                        }
                    }
                }
            });
        })
    }

    let viewerInstance = null; // 保存 Viewer 实例

    /**
     * 动态通过 URL 展示图片
     * @param {string} url 需要展示图片的 url
     */
    const showImageByUrl = (url) => {
        // 如果已有实例，先销毁旧的 Viewer
        if (viewerInstance) {
            viewerInstance.destroy();
            document.body.removeChild(viewerInstance.element);
        }

        // 动态创建图片元素
        let img = document.createElement('img');
        img.src = url;
        img.style.display = 'none'; // 隐藏原始图片 (仅用于 Viewer 初始化)
        document.body.appendChild(img);

        // 初始化 Viewer
        viewerInstance = new Viewer(img, {
            toolbar: {
                zoomIn: TOOLBAR_SETTING,
                zoomOut: TOOLBAR_SETTING,
                oneToOne: TOOLBAR_SETTING,
                reset: TOOLBAR_SETTING,
                rotateLeft: TOOLBAR_SETTING,
                rotateRight: TOOLBAR_SETTING,
                flipHorizontal: TOOLBAR_SETTING,
                flipVertical: TOOLBAR_SETTING
            },
            title: false, // 隐藏标题
            navbar: false, // 禁用导航栏
            keyboard: false, // 禁用键盘控制
            loop: false, // 单图关闭循环
            fullscreen: false, // 禁用全屏
            transition: false // 禁用过渡动画 (影响性能)
        });

        viewerInstance.show(); // 打开灯箱
    }

    // 使用事件委托动态屏蔽原本的点击事件，并使用灯箱展示图片
    document.addEventListener('click', async (event) => {
        if (event.target.tagName === 'IMG' && event.target.classList.contains('BDE_Image')) {
            event.preventDefault(); // 阻止默认行为
            event.stopPropagation(); // 阻止事件冒泡
            let original_url = await getOriginalUrl(event.target.src);
            showImageByUrl(original_url);
        }
    }, true);
})();