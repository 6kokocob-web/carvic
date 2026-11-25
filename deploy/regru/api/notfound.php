<?php
/* Все остальные /api/… (каталог, цены, кабинет, корзина) на этом хостинге пока не работают.
 * Сайт получает понятный JSON и показывает «Раздел временно недоступен» с телефоном.
 * /api/account/register тоже сюда: сайт сам перешлёт регистрацию заявкой в /api/inquiries. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
http_response_code(404);
echo json_encode(['ok' => false, 'error' => 'not_available', 'message' => 'Раздел временно недоступен. Позвоните: +7 (3952) 57-57-57.'], JSON_UNESCAPED_UNICODE);
