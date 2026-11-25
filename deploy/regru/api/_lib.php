<?php
/* Общие функции обработчиков заявок CARVIC (хостинг Рег.ру, PHP 7.4+).
 * Заявка уходит письмом на CARVIC_MAIL_TO и, если задан вебхук, лидом в Битрикс24.
 * Настройки — в api/config.php (пример — config.sample.php). */

declare(strict_types=1);

date_default_timezone_set('Asia/Irkutsk'); // время в письмах — иркутское

$CFG = [
    'mail_to'          => 'info@carvic.ru',
    'mail_from'        => 'noreply@carvic.ru',
    'bitrix24_webhook' => '',      // https://ВАШ.bitrix24.ru/rest/1/КЛЮЧ/  (права crm), пусто — только письмо
    'rate_limit'       => 5,       // заявок с одного IP
    'rate_window'      => 600,     // за столько секунд
];
if (is_file(__DIR__ . '/config.php')) {
    $over = include __DIR__ . '/config.php';
    if (is_array($over)) $CFG = array_merge($CFG, $over);
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $code, string $message): void
{
    respond($code, ['ok' => false, 'message' => $message]);
}

/* Только POST с JSON до 32 КБ */
function read_json(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'Метод не поддерживается.');
    $raw = file_get_contents('php://input', false, null, 0, 32769);
    if ($raw === false || strlen($raw) > 32768) fail(413, 'Слишком большой запрос.');
    $data = json_decode($raw, true);
    if (!is_array($data)) fail(400, 'Не удалось прочитать заявку.');
    return $data;
}

/* Строка из запроса: без управляющих символов, обрезана по длине */
function field(array $d, string $key, int $max = 200): string
{
    $v = $d[$key] ?? '';
    if (!is_string($v) && !is_numeric($v)) return '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$v) ?? '';
    $v = trim($v);
    return mb_substr($v, 0, $max);
}

function flag(array $d, string $key): bool
{
    return ($d[$key] ?? false) === true;
}

/* Телефон → +7XXXXXXXXXX; пустая строка, если не похож на российский номер */
function phone_norm(string $s): string
{
    $digits = preg_replace('/\D+/', '', $s) ?? '';
    if (strlen($digits) === 11 && ($digits[0] === '7' || $digits[0] === '8')) $digits = substr($digits, 1);
    return strlen($digits) === 10 ? '+7' . $digits : '';
}

/* Поле-ловушка для ботов: заполнено — делаем вид, что всё принято, но ничего не отправляем */
function honeypot(array $d): void
{
    if (field($d, 'company', 200) !== '') respond(200, ['ok' => true, 'id' => 'CV-' . date('ymd') . '-0000', 'note' => 'Заявка принята.']);
}

/* Не больше N заявок с одного IP за окно. Счётчики — в api/_store (закрыт от посетителей) */
function rate_limit(): void
{
    global $CFG;
    $dir = __DIR__ . '/_store';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0';
    $file = $dir . '/rl_' . hash('sha256', $ip . __DIR__) . '.json';
    $now = time();
    $hits = [];
    if (is_file($file)) {
        $hits = json_decode((string)@file_get_contents($file), true) ?: [];
        $hits = array_values(array_filter($hits, function ($t) use ($now, $CFG) { return is_int($t) && $t > $now - (int)$CFG['rate_window']; }));
    }
    if (count($hits) >= (int)$CFG['rate_limit']) fail(429, 'Слишком много заявок. Попробуйте через несколько минут или позвоните: +7 (3952) 57-57-57.');
    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);
}

function new_id(): string
{
    return 'CV-' . date('ymd') . '-' . str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);
}

/* Отправка: письмо (обязательно) + лид в Битрикс24 (если задан вебхук). $lines — [подпись => значение] */
function deliver(string $title, array $lines, string $replyTo = ''): void
{
    global $CFG;
    $id = new_id();
    $body = $title . "\nНомер: " . $id . "\nДата: " . date('d.m.Y H:i') . "\n\n";
    foreach ($lines as $k => $v) if ($v !== '' && $v !== null) $body .= $k . ': ' . $v . "\n";
    $body .= "\nОтправлено с сайта carvic.ru. IP: " . ($_SERVER['REMOTE_ADDR'] ?? '') . "\n";

    $subject = '=?UTF-8?B?' . base64_encode($title . ' ' . $id) . '?=';
    $headers = "From: CARVIC <" . $CFG['mail_from'] . ">\r\n"
        . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n";
    if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $headers .= 'Reply-To: ' . $replyTo . "\r\n";
    $mailed = @mail($CFG['mail_to'], $subject, $body, $headers, '-f' . $CFG['mail_from']);

    $crm = false;
    if (!empty($CFG['bitrix24_webhook'])) {
        $payload = http_build_query(['fields' => [
            'TITLE' => $title . ' ' . $id,
            'NAME' => $lines['Имя'] ?? ($lines['Контактное лицо'] ?? ''),
            'COMPANY_TITLE' => $lines['Организация'] ?? '',
            'PHONE' => !empty($lines['Телефон']) ? [['VALUE' => $lines['Телефон'], 'VALUE_TYPE' => 'WORK']] : [],
            'EMAIL' => $replyTo !== '' ? [['VALUE' => $replyTo, 'VALUE_TYPE' => 'WORK']] : [],
            'COMMENTS' => $body,
            'SOURCE_ID' => 'WEB',
        ]]);
        $ctx = stream_context_create(['http' => ['method' => 'POST', 'timeout' => 8,
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n", 'content' => $payload]]);
        $res = @file_get_contents(rtrim($CFG['bitrix24_webhook'], '/') . '/crm.lead.add.json', false, $ctx);
        $crm = $res !== false && strpos($res, '"result"') !== false;
    }
    if (!$mailed && !$crm) fail(502, 'Не удалось отправить заявку. Позвоните нам: +7 (3952) 57-57-57.');
    respond(200, ['ok' => true, 'id' => $id, 'note' => 'Менеджер свяжется с вами в рабочее время.']);
}
