  var CONFIDENCE_FLAG = 98;
  var CONFIDENCE_ISO = 92;
  var CONFIDENCE_NAME = 90;
  var CONFIDENCE_GEOIP = 78;
  var CONFIDENCE_GEOIP_WEAK = 70;
  var CONFIDENCE_CDN = 60;
  var COUNTRY = {
    HK:['Hong Kong','\u9999\u6e2f',['HK','HKG'],['\u9999\u6e2f','Hong Kong']],
    TW:['Taiwan','\u53f0\u6e7e',['TW','TWN'],['\u53f0\u6e7e','\u81fa\u7063','Taiwan']],
    MO:['Macau','\u6fb3\u95e8',['MO','MAC'],['\u6fb3\u95e8','\u6fb3\u9580','Macau','Macao']],
    US:['United States','\u7f8e\u56fd',['US','USA'],['\u7f8e\u56fd','\u7f8e\u897f','\u7f8e\u4e1c','\u7f8e\u5357','\u7f8e\u5317','United States','USA','America']],
    JP:['Japan','\u65e5\u672c',['JP','JPN'],['\u65e5\u672c','Japan','Tokyo','\u4e1c\u4eac','\u5927\u962a']],
    SG:['Singapore','\u65b0\u52a0\u5761',['SG','SGP'],['\u65b0\u52a0\u5761','\u72ee\u57ce','Singapore']],
    KR:['Korea','\u97e9\u56fd',['KR','KOR'],['\u97e9\u56fd','\u9996\u5c14','Korea','Seoul']],
    GB:['United Kingdom','\u82f1\u56fd',['GB','UK','GBR'],['\u82f1\u56fd','\u4f26\u6566','United Kingdom','Britain','London']],
    DE:['Germany','\u5fb7\u56fd',['DE','DEU'],['\u5fb7\u56fd','Germany','Frankfurt']],
    FR:['France','\u6cd5\u56fd',['FR','FRA'],['\u6cd5\u56fd','France','Paris']],
    NL:['Netherlands','\u8377\u5170',['NL','NLD'],['\u8377\u5170','Netherlands','Holland']],
    CA:['Canada','\u52a0\u62ff\u5927',['CA','CAN'],['\u52a0\u62ff\u5927','Canada']],
    AU:['Australia','\u6fb3\u5927\u5229\u4e9a',['AU','AUS'],['\u6fb3\u5927\u5229\u4e9a','\u6fb3\u6d32','Australia']],
    RU:['Russia','\u4fc4\u7f57\u65af',['RU','RUS'],['\u4fc4\u7f57\u65af','Russia','Moscow']],
    IN:['India','\u5370\u5ea6',['IN','IND'],['\u5370\u5ea6','India']],
    VN:['Vietnam','\u8d8a\u5357',['VN','VNM'],['\u8d8a\u5357','Vietnam']],
    TH:['Thailand','\u6cf0\u56fd',['TH','THA'],['\u6cf0\u56fd','Thailand']],
    MY:['Malaysia','\u9a6c\u6765\u897f\u4e9a',['MY','MYS'],['\u9a6c\u6765\u897f\u4e9a','Malaysia']],
    PH:['Philippines','\u83f2\u5f8b\u5bbe',['PH','PHL'],['\u83f2\u5f8b\u5bbe','Philippines']],
    TR:['Turkey','\u571f\u8033\u5176',['TR','TUR'],['\u571f\u8033\u5176','Turkey']],
    ES:['Spain','\u897f\u73ed\u7259',['ES','ESP'],['\u897f\u73ed\u7259','Spain']],
    IT:['Italy','\u610f\u5927\u5229',['IT','ITA'],['\u610f\u5927\u5229','Italy']],
    SE:['Sweden','\u745e\u5178',['SE','SWE'],['\u745e\u5178','Sweden']],
    FI:['Finland','\u82ac\u5170',['FI','FIN'],['\u82ac\u5170','Finland','Helsinki','\u8d6b\u5c14\u8f9b\u57fa']],
    RO:['Romania','\u7f57\u9a6c\u5c3c\u4e9a',['RO','ROU'],['\u7f57\u9a6c\u5c3c\u4e9a','Romania']],
    PL:['Poland','\u6ce2\u5170',['PL','POL'],['\u6ce2\u5170','Poland']],
    CZ:['Czechia','\u6377\u514b',['CZ','CZE'],['\u6377\u514b','Czech','Czechia']],
    CH:['Switzerland','\u745e\u58eb',['CH','CHE'],['\u745e\u58eb','Switzerland']],
    LV:['Latvia','\u62c9\u8131\u7ef4\u4e9a',['LV','LVA'],['\u62c9\u8131\u7ef4\u4e9a','Latvia']],
    EE:['Estonia','\u7231\u6c99\u5c3c\u4e9a',['EE','EST'],['\u7231\u6c99\u5c3c\u4e9a','Estonia']],
    MD:['Moldova','\u6469\u5c14\u591a\u74e6',['MD','MDA'],['\u6469\u5c14\u591a\u74e6','Moldova']],
    AR:['Argentina','\u963f\u6839\u5ef7',['AR','ARG'],['\u963f\u6839\u5ef7','Argentina']],
    ZA:['South Africa','\u5357\u975e',['ZA','ZAF'],['\u5357\u975e','South Africa']],
    NG:['Nigeria','\u5c3c\u65e5\u5229\u4e9a',['NG','NGA'],['\u5c3c\u65e5\u5229\u4e9a','Nigeria']],
    NZ:['New Zealand','\u65b0\u897f\u5170',['NZ','NZL'],['\u65b0\u897f\u5170','New Zealand']]
  };
  function flagToCC(s) {
    s = String(s || '');
    for (var i = 0; i < s.length - 3; i++) {
      var a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2), d = s.charCodeAt(i + 3);
      if (a === 0xD83C && c === 0xD83C && b >= 0xDDE6 && b <= 0xDDFF && d >= 0xDDE6 && d <= 0xDDFF) {
        return String.fromCharCode(65 + b - 0xDDE6) + String.fromCharCode(65 + d - 0xDDE6);
      }
    }
    return '';
  }
  function countryInfo(code, source, confidence) {
    var c = COUNTRY[code] || null;
    if (!c) return { countryCode: 'UN', country: '\u672a\u77e5', countrySource: 'none', countryConfidence: 0 };
    return { countryCode: code, country: c[1], countrySource: source || 'rule', countryConfidence: confidence || 80 };
  }
  function isCFServer(server) {
    server = String(server || '').toLowerCase();
    if (/cloudflare|workers\.dev|pages\.dev/.test(server)) return true;
    if (/^(104\.(1[6-9]|2[0-9]|3[0-1])\.|172\.(6[4-9]|7[0-1])\.|162\.158\.|190\.93\.|188\.114\.|141\.101\.|108\.162\.|198\.41\.)/.test(server)) return true;
    return false;
  }
  function detectCountry(name, server, extra) {
    name = String(name || ''); server = String(server || ''); extra = extra || {};
    var text = [name, server, extra.country, extra.countryCode, extra.sni, extra.servername, extra.Host, extra.host].join(' ');
    var explicit = flagToCC(text);
    if (explicit && COUNTRY[explicit]) return countryInfo(explicit, 'flag', CONFIDENCE_FLAG);
    var upper = text.toUpperCase();
    var keys = Object.keys(COUNTRY);
    for (var i = 0; i < keys.length; i++) {
      var code = keys[i];
      var arr = COUNTRY[code][2];
      for (var j = 0; j < arr.length; j++) {
        var token = arr[j].toUpperCase();
        var re = new RegExp('(?:^|[^A-Z0-9])' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[^A-Z0-9]|$)');
        if (re.test(upper)) return countryInfo(code, 'iso', CONFIDENCE_ISO);
      }
      var names = COUNTRY[code][3];
      for (var k = 0; k < names.length; k++) {
        if (text.indexOf(names[k]) >= 0 || upper.indexOf(String(names[k]).toUpperCase()) >= 0) return countryInfo(code, 'name', CONFIDENCE_NAME);
      }
    }
    if (/CF\s*\u4e2d\u8f6c|\u4e2d\u8f6c|Cloudflare|Anycast|CDN/i.test(text) || isCFServer(server)) {
      return { countryCode: 'CDN', country: 'CDN/\u4e2d\u8f6c', countrySource: 'cdn', countryConfidence: CONFIDENCE_CDN };
    }
    return { countryCode: 'UN', country: '\u672a\u77e5', countrySource: 'none', countryConfidence: 0 };
  }
