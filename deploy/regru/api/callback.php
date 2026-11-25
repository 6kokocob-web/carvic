<?php
/* POST /api/callback-request — «Заказать звонок» */
require __DIR__ . '/_lib.php';

$d = read_json();
honeypot($d);
if (!flag($d, 'consentRequest')) fail(400, 'Нужно согласие на обработку персональных данных.');
$phone = phone_norm(field($d, 'phone', 30));
if ($phone === '') fail(400, 'Проверьте номер телефона.');
rate_limit();
deliver('Обратный звонок', [
    'Имя' => field($d, 'name', 80),
    'Телефон' => $phone,
    'Комментарий' => field($d, 'message', 1000),
    'Согласие на обработку ПДн' => 'да',
]);
