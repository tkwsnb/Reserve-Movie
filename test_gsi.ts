const address = "東京都新宿区歌舞伎町1-19-1";
const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;

console.log(`Fetching ${url}...`);

try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
} catch (e) {
    console.error(e);
}
