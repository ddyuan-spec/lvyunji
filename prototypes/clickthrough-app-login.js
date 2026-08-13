/**
 * 绿韵家 App 登录注册原型 · 点击穿透测试
 * 用法：NODE_PATH="..." node clickthrough-app-login.js app-login-v2.html
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function loadJsdom() {
  try { return require('jsdom'); }
  catch (e) {
    const tmp = path.join(os.tmpdir(), 'proto_clickthrough_jsdom');
    execSync('npm install jsdom --prefix "' + tmp + '" --no-save --silent', { stdio: 'inherit' });
    return require(path.join(tmp, 'node_modules', 'jsdom'));
  }
}
const { JSDOM, VirtualConsole } = loadJsdom();

const FILE = process.argv[2];
if (!FILE || !fs.existsSync(FILE)) { console.error('用法: node clickthrough-app-login.js <原型.html>'); process.exit(2); }
const html = fs.readFileSync(FILE, 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.stack || e.detail || e.message));
vc.on('error', (...a) => errors.push(a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  virtualConsole: vc,
  pretendToBeVisual: true,
  beforeParse(window) {
    window.confirm = () => true;
    window.alert = () => {};
    window.prompt = () => '';
    window.$ = id => window.document.getElementById(id);
    window.toast = () => {};
  }
});
const { window } = dom;
const { document } = window;

let fails = 0;
const fail = m => { console.log('  ✗ ' + m); fails++; };
const ok = m => console.log('  ✓ ' + m);
const assert = (cond, msg) => cond ? ok(msg) : fail(msg);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async function() {
  // Step 1: 初始页为验证码登录
  assert(document.getElementById('code-login').classList.contains('active'), '初始页：验证码登录为 active');

  // Step 2: 切换到账号密码登录
  document.querySelector('#code-login .tab:last-child').click();
  await wait(50);
  assert(document.getElementById('pwd-login').classList.contains('active'), '点击 tab → 账号密码页 active');

  // Step 3: 切换回验证码登录
  document.querySelector('#pwd-login .tab:first-child').click();
  await wait(50);
  assert(document.getElementById('code-login').classList.contains('active'), '点击 tab → 验证码登录页 active');

  // Step 4: 点击忘记密码
  document.querySelector('#code-login .link').click();
  await wait(50);
  assert(document.getElementById('forgot').classList.contains('active'), '点击忘记密码 → 忘记密码页 active');

  // Step 5: 从忘记密码返回
  document.querySelector('#forgot .back').click();
  await wait(50);
  assert(document.getElementById('code-login').classList.contains('active'), '忘记密码页返回 → 回到验证码登录');

  // Step 6: 勾选协议
  const cb = document.getElementById('agree-check');
  cb.click();
  await wait(50);
  assert(cb.classList.contains('on'), '点击 checkbox → 协议已勾选');

  // Step 7: 点击用户协议链接
  document.querySelector('a[data-target="user"]').click();
  await wait(50);
  assert(document.getElementById('agreement').classList.contains('active'), '点击用户协议 → 协议页 active');
  assert(document.getElementById('agree-title').textContent === '用户协议', '协议页默认显示用户协议');

  // Step 8: 切换到隐私政策
  document.getElementById('tab-privacy').click();
  await wait(50);
  assert(document.getElementById('agree-title').textContent === '隐私政策', '点击隐私政策 tab → 标题变为隐私政策');

  // Step 9: 从协议页返回
  document.querySelector('#agreement .back').click();
  await wait(50);
  assert(document.getElementById('code-login').classList.contains('active'), '协议页返回 → 回到验证码登录');

  // Step 10: 输入手机号和验证码，登录按钮高亮
  document.getElementById('phone-code').value = '13800138001';
  document.getElementById('phone-code').dispatchEvent(new window.Event('input'));
  document.getElementById('code').value = '123456';
  document.getElementById('code').dispatchEvent(new window.Event('input'));
  await wait(50);
  assert(!document.getElementById('btn-code').classList.contains('disabled'), '输入合法手机号+验证码+勾选协议 → 登录按钮可用');

  // Step 11: 密码页眼睛开关
  document.querySelector('#code-login .tab:last-child').click();
  await wait(50);
  const eye = document.querySelector('#pwd-login .eye');
  const pwdInput = document.getElementById('password');
  pwdInput.value = '123456';
  eye.click();
  await wait(50);
  assert(pwdInput.type === 'text', '点击眼睛 → 密码明文显示');
  eye.click();
  await wait(50);
  assert(pwdInput.type === 'password', '再次点击眼睛 → 密码密文显示');

  // Step 12: 密码页登录按钮状态
  document.getElementById('phone-pwd').value = '13800138001';
  document.getElementById('phone-pwd').dispatchEvent(new window.Event('input'));
  document.getElementById('password').dispatchEvent(new window.Event('input'));
  await wait(50);
  assert(!document.getElementById('btn-pwd').classList.contains('disabled'), '密码页输入合法 → 登录按钮可用');

  // Step 13: 忘记密码页重置按钮状态
  document.querySelector('#pwd-login .link:last-child').click();
  await wait(50);
  document.getElementById('phone-forgot').value = '13800138001';
  document.getElementById('phone-forgot').dispatchEvent(new window.Event('input'));
  document.getElementById('code-forgot').value = '123456';
  document.getElementById('code-forgot').dispatchEvent(new window.Event('input'));
  document.getElementById('new-pwd').value = '123456';
  document.getElementById('new-pwd').dispatchEvent(new window.Event('input'));
  document.getElementById('new-pwd2').value = '123456';
  document.getElementById('new-pwd2').dispatchEvent(new window.Event('input'));
  await wait(50);
  assert(!document.getElementById('btn-reset').classList.contains('disabled'), '忘记密码页输入一致 → 重置按钮可用');

  if (errors.length) {
    errors.forEach(e => fail('JS错误: ' + e));
  } else {
    ok('全程无 JS 运行期错误');
  }

  console.log('\n' + (fails === 0 ? '✅ 登录注册原型点击穿透测试通过' : `❌ ${fails} 项失败`));
  process.exit(fails === 0 ? 0 : 1);
})();
