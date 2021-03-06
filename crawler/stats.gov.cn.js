import fs from 'fs';
import { URL } from 'url';
import path from 'path';
import request from 'request-promise';
import cheerio from 'cheerio';
// import urlencode from 'urlencode';
// import Iconv from 'iconv-lite';
import trim from './utils/trim';
import makeLog from './utils/log';

// 日志文件
const logFile = makeLog(path.join(__dirname, `../crawler/logs/stats.gov.cn.${(new Date()).getTime()}.txt`));

/**
 * 解析具体的内容并生成文件
 *
 * @param {String} url - 具体行政区域码的内容页地址
 */
const parseDetail = async (url) => {
  const html = await request(url);
  const $ = cheerio.load(html);

  // const filename = trim($('h2.xilan_tit').text())
  //   .match(/(\d{2,4})年(\d{1,2})月(\d{1,2})日/)
  //   .filter((e) => e === `${parseInt(e, 10)}`)
  //   .map((e) => ((e.length === 1) ? `0${e}` : e))
  //   .join('');
  const filename = trim($('h2.xilan_tit').text())
    .match(/(\d{4})年/)[1];
  const provinces = [];
  const cities = [];
  const counties = [];

  const content = trim($('div.xilan_con').text().replace(/^\D+(\d)/, '$1'));
  const fileContent = content.replace(/(\d{6})(\s)?/g, '#$1').split('#')
    .map((t) => {
      const tMatch = t.match(/(\d{6})(\D+)/);
      // analytics
      if (
        tMatch !== null &&
        tMatch[1] &&
        tMatch[1].length !== 0
      ) {
        if (/\d{2}0{4}/.test(tMatch[1])) {
          provinces.push(tMatch[1]);
        } else if (/\d{4}0{2}/.test(tMatch[1])) {
          cities.push(tMatch[1]);
        } else {
          counties.push(tMatch[1]);
        }
      }

      return (
        tMatch !== null &&
        tMatch[1] &&
        tMatch[1].length !== 0 &&
        tMatch[2] &&
        tMatch[2].length !== 0
      ) ?
        {
          code: tMatch[1],
          name: trim(tMatch[2], true),
        } :
        null;
    }).filter((i) => (i !== null));

  if (fileContent && fileContent.length) {
    makeCodeFile(filename, fileContent);
  }

  const log = `
------------------
total: ${fileContent.length}, province: ${provinces.length}, city: ${cities.length}, county: ${counties.length}
url: ${url}
file: ${filename}.json
------------------
  `;
  console.log(log);

  // 记录日志
  logFile.add(log);
};

/**
 * 生成数据文件
 *
 * @param {String} filename - 文件名字
 * @param {Object} content - 文件内容
 */
const makeCodeFile = (filename, content) => {
  fs.writeFileSync(
    path.join(__dirname, `../data/stats.gov.cn/${filename}.json`),
    JSON.stringify(content, null, 2),
    'utf8',
  );
};


/**
 * 解析入口地址，区分最近一年及往年的信息
 *
 * @param {String} entryUrl - 民政部中《中华人民共和国行政区划代码》的入口地址
 */
(async (entryUrl) => {
  const html = await request(entryUrl);
  const $ = cheerio.load(html);
  const queues = [];

  $('ul.center_list_contlist').find('li>a').each((i, m) => {
    const dateMatch = $(m).find('.cont_tit02').text().match(/(\d{2,4})-(\d{1,2})-(\d{1,2})/);
    const detailUrl = (new URL($(m).attr('href'), entryUrl).toString());
    if (dateMatch !== null && detailUrl.length) {
      const date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
      queues.push({
        url: detailUrl,
        date,
        time: (new Date(date)).getTime(),
        year: dateMatch[1],
      });
    }
  });

  queues.sort((m, n) => (
    n.time - m.time
  )).filter((m, i) => (
    !((i > 1) &&
    m.year === queues[i - 1].year &&
    m.time < queues[i - 1].time)
  )).forEach((m) => {
    parseDetail(m.url);
  });

  return true;
})('http://www.stats.gov.cn/tjsj/tjbz/xzqhdm/');

// parseDetail('http://www.stats.gov.cn/tjsj/tjbz/xzqhdm/200410/t20041022_38305.html');
