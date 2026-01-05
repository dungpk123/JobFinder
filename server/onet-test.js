const username = 'ntdungpk123@gmail.com';
const password = 'dungpk11032003';
const auth = Buffer.from(`${username}:${password}`).toString('base64');

fetch('https://services.onetcenter.org/ws/online/occupations/', {
  headers: {
    'Authorization': `Basic ${auth}`
  }
})
.then(async res => {
  const text = await res.text();
  console.log(text);
})
  .then(data => console.log(data))
  .catch(err => console.error(err));
