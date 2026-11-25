<?php
/* POST /api/opt/register — заявка оптового покупателя / автосервиса */
require __DIR__ . '/_lib.php';

$d = read_json();
honeypot($d);
if (!flag($d, 'acceptTerms') || !flag($d, 'acceptOpt')) fail(400, 'Нужно принять пользовательское соглашение и условия поставки.');
$org = field($d, 'organization', 200);
$inn = preg_replace('/\D+/', '', field($d, 'inn', 20)) ?? '';
$kpp = preg_replace('/\D+/', '', field($d, 'kpp', 20)) ?? '';
$phone = phone_norm(field($d, 'phone', 30));
$email = field($d, 'email', 120);
if ($org === '') fail(400, 'Укажите организацию.');
if (!preg_match('/^(\d{10}|\d{12})$/', $inn)) fail(400, 'ИНН — 10 или 12 цифр.');
if ($kpp !== '' && !preg_match('/^\d{9}$/', $kpp)) fail(400, 'КПП — 9 цифр.');
if ($phone === '') fail(400, 'Проверьте номер телефона.');
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Проверьте e-mail.');
rate_limit();
deliver('Заявка оптового покупателя', [
    'Организация' => $org,
    'ИНН' => $inn,
    'КПП' => $kpp,
    'Контактное лицо' => field($d, 'contactName', 120),
    'Телефон' => $phone,
    'E-mail' => $email,
    'Пользовательское соглашение и условия поставки' => 'приняты',
    'Согласие на рассылки' => flag($d, 'acceptAds') ? 'да' : 'нет',
], $email);
