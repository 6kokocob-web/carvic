<?php
/* POST /api/inquiries — заявка на подбор / цену / обращение (главная «Не нашли деталь?», окно «Оставить заявку», регистрация) */
require __DIR__ . '/_lib.php';

$d = read_json();
honeypot($d);
if (!flag($d, 'consentRequest')) fail(400, 'Нужно согласие на обработку персональных данных.');

$name = field($d, 'name', 80);
$contact = field($d, 'contact', 160);
if ($name === '') fail(400, 'Укажите имя.');
if ($contact === '') fail(400, 'Укажите телефон или e-mail.');
// в поле может быть «телефон, e-mail» (так приходит регистрация)
$phone = ''; $email = '';
foreach (preg_split('/[,;]+/', $contact) ?: [] as $part) {
    $part = trim($part);
    if ($phone === '' && phone_norm($part) !== '') $phone = phone_norm($part);
    if ($email === '' && filter_var($part, FILTER_VALIDATE_EMAIL)) $email = $part;
}
if ($phone === '' && $email === '') fail(400, 'Проверьте телефон или e-mail.');

$kinds = ['selection' => 'Подбор запчастей', 'price' => 'Запрос цены', 'contact' => 'Обращение', 'availability' => 'Наличие'];
$kind = field($d, 'kind', 30);
rate_limit();
deliver('Заявка с сайта: ' . ($kinds[$kind] ?? 'Обращение'), [
    'Имя' => $name,
    'Телефон' => $phone !== '' ? $phone : '',
    'Контакт' => $contact,
    'Что нужно' => field($d, 'message', 2000),
    'Артикул' => field($d, 'article', 120),
    'Бренд' => field($d, 'brand', 80),
    'VIN / кузов' => field($d, 'vin', 40),
    'Магазин' => field($d, 'outletId', 60),
    'Согласие на обработку ПДн' => 'да',
], $email);
