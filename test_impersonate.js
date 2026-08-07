const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const cookies = res.headers['set-cookie'];
    if (!cookies) return;
    const sessionCookie = cookies.find(c => c.startsWith('app_session=')).split(';')[0];
    
    // Fetch users
    const usersReq = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'GET',
      headers: { 'Cookie': sessionCookie }
    }, (usersRes) => {
      let usersData = '';
      usersRes.on('data', d => usersData += d);
      usersRes.on('end', () => {
        const payload = JSON.parse(usersData);
        const target = payload.users.find(u => u.username === 'tirth');
        console.log('Target user ID:', target.id);
        
        // Impersonate
        const impReq = http.request({
          hostname: 'localhost',
          port: 3000,
          path: '/api/admin/impersonate',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          }
        }, (impRes) => {
          let impData = '';
          impRes.on('data', d => impData += d);
          impRes.on('end', () => {
            console.log('Impersonate status:', impRes.statusCode);
            console.log('Impersonate response:', impData);
            console.log('Impersonate cookies:', impRes.headers['set-cookie']);
          });
        });
        
        impReq.write(JSON.stringify({ userId: target.id }));
        impReq.end();
      });
    });
    usersReq.end();
  });
});

req.write(JSON.stringify({ username: 'superadmin', password: 'Super@123' }));
req.end();
