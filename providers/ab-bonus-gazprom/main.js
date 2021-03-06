/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Получает информацию о бонусах на карте Газпромнефть - Нам по пути.

Сайт программы: http://www.gpnbonus.ru
*/

function img2status(str){
    var statuses = {
        silver: 'Серебряный',
        gold: 'Золотой',
        platinum: 'Платиновый'
    };

    return statuses[str] || str;
}

function num2(n){
	return n < 10 ? '0' + n : '' + n;
}

function main() {
	var prefs = AnyBalance.getPreferences();
	var baseurl='https://www.gpnbonus.ru/';
	AnyBalance.trace('Sending a request for authorization');
	AnyBalance.setDefaultCharset('utf-8');
	
	var html = AnyBalance.requestGet(baseurl + 'login/');
	
	var form = getParam(html, null, null, /<form[^>]+id="login_form"[^>]*>([\s\S]*?)<\/form>/i);
	if(!form)
		throw new AnyBalance.Error('Не найдена форма входа. Сайт изменен?');
	
	var params = createFormParams(form);
	
	if(params.captcha_code){
		if(AnyBalance.getLevel() >= 7){
			AnyBalance.trace('Пытаемся ввести капчу');
			var captcha = AnyBalance.requestGet(baseurl + 'bitrix/tools/captcha.php?captcha_code=' + params.captcha_code);
			params.captcha_word = AnyBalance.retrieveCode("Пожалуйста, введите код с картинки", captcha);
			AnyBalance.trace('Капча получена: ' + params.captcha_word);
		}else{
			throw new AnyBalance.Error('К сожалению, сайт http://www.gpnbonus.ru ввел капчу (ввод циферок с картинки) для входа в личный кабинет. Пожалуйста, обратитесь в справочную службу ГазПромНефть по телефону 8 800 700 5151 и попросите отменить капчу или сделать интерфейс для автоматических программ.');
        }
	}
	AnyBalance.trace('Отправляем данные: ' + JSON.stringify(params));
	params.login = prefs.login;
	params.password = prefs.password;
	
	var html = AnyBalance.requestPost(baseurl + 'oneLogin/ru/', params);
	var json = getJson(html);
	if(json.action != 'login_ok'){
		if(json.mess)
			throw new AnyBalance.Error(json.mess, null, /неверный номер карты/i.test(json.mess));
	    AnyBalance.trace(html);
		throw new AnyBalance.Error ('Не удаётся зайти в личный кабинет. Возможно, неправильный логин, пароль или сайт изменен.');
	}

	AnyBalance.trace('Authorization was successful');

	html = AnyBalance.requestGet(baseurl + 'profile-online/main/');

	if(/twopass/i.test(html)){
		throw new AnyBalance.Error('Газпромбонус просит сменить пароль. Пожалуйста, зайдите в личный кабинет через браузер и смените пароль.', null, true);
	}

	AnyBalance.trace('Start parsing...');
	
	var result = {success: true};
	var balance = getParam(html, null, null, /Бонусов доступно[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, parseBalance);
	getParam(balance, result, 'balance');

	//getParam(html, result, 'balance', /Бонусов доступно[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, parseBalance);
	var reStatus = prefs.zone == 1 ? /Текущий статус карты в 1[\s\S]*?<img[^>]+src="[^"]*images\/([^\/"]*)\.png"[^>]*>/i : /Текущий статус карты в 2[\s\S]*?<img[^>]+src="[^"]*images\/([^\/"]*)\.png"[^>]*>/i;
	var reSave = prefs.zone == 1 ? /Для подтверждения статуса в 1(?:[\s\S](?!<\/p>))*необходимо совершить покупки на сумму[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i : /Для подтверждения статуса в 2(?:[\s\S](?!<\/p>))*необходимо совершить покупки на сумму[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i;
	var reHeighten = prefs.zone == 1 ? /Для повышения статуса в 1(?:[\s\S](?!<\/p>))*необходимо совершить покупки на сумму[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i : /Для повышения статуса в 2(?:[\s\S](?!<\/p>))*необходимо совершить покупки на сумму[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i;
	getParam(html, result, 'status', reStatus, replaceTagsAndSpaces, img2status);
	getParam(html, result, '__tariff', reStatus, replaceTagsAndSpaces, img2status);
	getParam(html, result, 'month_need', reSave, replaceTagsAndSpaces, parseBalance);
	
	var dt = new Date();
	var curMonth = num2(dt.getMonth() + 1) + '.' + dt.getFullYear();

	getParam(html, result, 'customer', /<div[^>]+class="[^"]*PersonalName"[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(html, result, 'month_need_up', reHeighten, replaceTagsAndSpaces, parseBalance);

	if(prefs.zone != 1 && AnyBalance.isAvailable('month2', 'month')){
		html = AnyBalance.requestPost(baseurl + 'profile-online/statistics/handler.php', {year: '0', month: '0'});
		sumParam(html, result, ['month2', 'month'], new RegExp('<tr[^>]*>\\s*<td[^>]*>\\d+\\.' + curMonth + '(?:(?:[\\s\\S](?!</tr>))*?<td[^>]*>){3}([\\s\\S]*?)</td>', 'ig'), replaceTagsAndSpaces, parseBalance, aggregate_sum);
	}

	if(prefs.zone == 1 && AnyBalance.isAvailable('month1', 'month')){
		html = AnyBalance.requestGet(baseurl + 'profile-online/statistics/index-online.php');
		sumParam(html, result, ['month1', 'month'], new RegExp('<tr[^>]*>\\s*<td[^>]*>\\d+\\.' + curMonth + '(?:(?:[\\s\\S](?!</tr>))*?<td[^>]*>){3}([\\s\\S]*?)</td>', 'ig'), replaceTagsAndSpaces, parseBalance, aggregate_sum);
	}
	
	if(AnyBalance.isAvailable('month')){
		getParam((result.month1 || 0) + (result.month2 || 0), result, 'month');
	}
	
	//Баланс по курсу в рублях
    /* Курс теперь 1:1, так что неинтересно смотреть.	
	if(AnyBalance.isAvailable('balance_money', 'kurs')) {
		html=AnyBalance.requestGet("https://www.gpnbonus.ru/on_the_way/");
		var regexp = /Наш курс:\D*(\d+)\s*бонус[^=]*=\s*(\d+)\s*руб/;
		if (res = regexp.exec(html)) {
			result.balance_money = Math.floor(((result.balance*res[2])/res[1])*100)/100;
		}
		getParam(html, result, 'kurs', /Наш курс:\s*<b>([^<]*)/i, replaceTagsAndSpaces, parseBalance);
	} */
	AnyBalance.trace('End parsing...');
	AnyBalance.setResult(result);
}