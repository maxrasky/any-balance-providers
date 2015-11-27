/**
 * AnyBanalance provider for http://bananawars.ru
 */

function main(){
  var prefs = AnyBalance.getPreferences(),
      baseurl = 'http://bananawars.ru/',
      result = {success: true},
      html;

  AnyBalance.setDefaultCharset('utf-8');

  checkEmpty(prefs.login, 'Введите имя');
  checkEmpty(prefs.password, 'Введите пароль');

  html = AnyBalance.requestPost(baseurl + 'index.php', {
    auth_name: prefs.login,
    auth_pass: prefs.password
  });

  if (!/logout/.test(html)) {
    throw new AnyBalance.Error('Неверный логин или пароль!');
  }

  AnyBalance.trace('Trying to find out the characteristics');

  var searchValues = ['уровень:', 'бустеры:', 'деньги:', 'очки:', 'почта:'];
  var counters = ['level', 'booster', 'money', 'score', 'mail'];

  for (var i = 0; i < searchValues.length; i++) {
    var res = getRegEx(searchValues[i]).exec(html);

    if (res) {
      var matches = res[0].match(/<a[^>]*>([^]*?)<\/a>/igm);

      res = matches.map(function(value) {
        return value.replace(/<[^>]*>/g, '').replace(/[^\d\/]+/g, '');
      });

      if (res && res.length == 2) {
        result[counters[i]] = res[1];
      }
    }
  }

  AnyBalance.setResult(result);
}

function getRegEx(srcValue) {
  var str = '<(td)[^>]*>.*?' + srcValue + '[^]*?</\\1>';
  return new RegExp(str, 'igm');
}
