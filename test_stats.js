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
    
    // Fetch users to get ID
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
            const impCookies = impRes.headers['set-cookie'];
            const targetSession = impCookies.find(c => c.startsWith('app_session=')).split(';')[0];
            
            // Fetch stats
            const statsReq = http.request({
              hostname: 'localhost',
              port: 3000,
              path: '/api/stats?from=2026-08-05&to=2026-08-05',
              method: 'GET',
              headers: { 'Cookie': targetSession }
            }, (statsRes) => {
              let statsData = '';
              statsRes.on('data', d => statsData += d);
              statsRes.on('end', () => {
                console.log('Stats length:', statsData.length);
                const stats = JSON.parse(statsData);
                console.log('stats keys:', Object.keys(stats));
                console.log('stats.records:', stats.records);
              });
            });
            statsReq.end();
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
