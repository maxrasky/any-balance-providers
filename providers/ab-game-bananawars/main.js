/**
 * AnyBanalance provider for http://bananawars.ru
 */

var g_headers = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Charset': 'windows-1251,utf-8;q=0.7,*;q=0.3',
  'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
  'Connection': 'keep-alive',
  'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1547.76 Safari/537.36',
};

function main(){
  var prefs = AnyBalance.getPreferences(),
      baseurl = 'http://bananawars.ru/',
      result = {success: true},
      html;

  AnyBalance.setDefaultCharset('utf-8');

  checkEmpty(prefs.login, 'Введите имя');
  checkEmpty(prefs.password, 'Введите пароль');

  html = AnyBalance.requestGet(baseurl, g_headers);

  if(!html || AnyBalance.getLastStatusCode() > 400) {
    AnyBalance.trace(html);
    throw new AnyBalance.Error('Ошибка при подключении к сайту провайдера! Попробуйте обновить данные позже.');
  }

  html = AnyBalance.requestPost(baseurl + 'index.php', {
    auth_name: prefs.login,
    auth_pass: prefs.password
  });

  if (!/logout/.test(html)) {
    var re = /<td[^>]*>(?:(?!<td[^>]*>).)*?Забыли пароль.*?<\/td>/i,
        error = getParam(html, null, null, re, replaceTagsAndSpaces, html_entity_decode),
        isFatal = false;

    if (error) {
      isFatal = /Пользователь не найден|Неправильный пароль/i.test(error);
      throw new AnyBalance.Error(error, null, isFatal);
    }

    AnyBalance.trace(html);
    throw new AnyBalance.Error('Не удалось зайти в аккаунт. Сайт изменен?');
  }

  AnyBalance.trace('Пытаюсь получить характеристики');

  var searchValues = ['уровень:', 'бустеры:', 'деньги:', 'очки:', 'почта:'];
  var counters = ['level', 'booster', 'money', 'score', 'mail'];

  for (var i = 0; i < searchValues.length; i++) {
    var res = getRegEx(searchValues[i]).exec(html),
        reReplaces = [/<[^>]*>/g, '', /[^\d\/]+/g, ''];

    if (res) {
      getParam(res[0], result, counters[i], /<a[^>]*>([^]*?)<\/a>/igm, reReplaces);
    }
  }

  AnyBalance.setResult(result);
}

function getRegEx(srcValue) {
  var str = '<(td)[^>]*>.*?' + srcValue + '[^]*?</\\1>';
  return new RegExp(str, 'igm');
}
