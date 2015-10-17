# revsw-proxy-tester
A tool to test the functionality of new proxy server versions.

## Overview

Proxy tester consists of two parts - `collect.js` and `request_compare.js`.

The main goal of the `collect.js` - search ES server to collect logged requests, aggregating(grouping) them by `domain`, `method`, `port`, `request`, `agent` and `referer` fields.

Aggregated combinations are being filtered by frequency, i.e. only those  combinations (`domain`, `method` etc) are stored, the frequency of which exceeds a predetermined threshold.

The main purpose of the `request_compare.js` - is sending requests to test the new proxy server.

Requests are generated from previously collected and stored data (by `collect.js`) and sent through a 2 proxy servers - Production and Test(new one). Requests are being sent twice through each server to ensure that the parameter "x-rev-cache" to be "HIT".

Then the responses of the last two requests are being compared.
If the number of successful comparisons divided by the total number of requests exceeds a threshold (95%) - check is passed.


## Install

Clone it from the repository
```bash
# git clone git@github.com:revrepo/revsw-proxy-tester.git
```
then install dependencies
```bash
# cd revsw-proxy-tester
# npm install
```
It goes without saying, that the last version of node.js should be installed in the system.


## Usage of `collect.js`
##### CAUTION:
Elasticsearch provides aggregation rig for grouping requests with equal values of the given fields. Unfortunately, nested aggregations is very RAM(and time) consuming operation, incorrect parameter settings may lead to server crash.

To start it type as follows:
```bash
# [NODE_ENV=production] node collect.js [..options..]
```
The presence of the `NODE_ENV=production` means that all requests will run to the production Elasticsearch cluster. And vice versa - absence of it means that you work/play with the testing Elasticsearch cluster.

Options are as follows:
```
  -C :
      Collection mode (default)
  -d, --domain :
      domain name or names(space delimited) for the collection mode (required)
  -i, --index :
      index name, optional, used `logstash-YYYY.MM.DD` (today's) if omited
  --min-count :
      least amount of hits for every combination of port+request+method+agent+referer
  -o, --out :
      file name to store output, "[domain[0]].json" is default
  -D, --domain-list :
      Domains list mode, for the given (optional) index
  -I, --indices-list :
      indices List mode
  -H, --health (cluster(default) | indices | shards) :
      Cluster Health mode
  -v, --verbose :
      blabbing output
```


#### Examples
To get indices list(filtered to Oct 2015 below):
```bash
# NODE_ENV=production node collect.js -I logstash-2015.10* -v
info: Indices list:
health status index               pri rep docs.count docs.deleted store.size pri.store.size
green  open   logstash-2015.10.15   5   1   93877432            0    115.9gb         57.9gb
green  open   logstash-2015.10.14   5   1   82043012            0      102gb           51gb
green  open   logstash-2015.10.17   5   1   44025170            0     55.4gb         27.5gb
green  open   logstash-2015.10.11   5   1   82873816            0    101.8gb         50.9gb
green  open   logstash-2015.10.10   5   1   94795876            0    115.3gb         57.6gb
......
```
To get domains list for the given index:
```bash
NODE_ENV=production node collect.js -D -i logstash-2015.10.15 -v
info: Domains list:
{ '0': { key: 'www.metacafe.com', doc_count: 23345141 },
  '1': { key: 's4.mcstatic.com', doc_count: 10332318 },
  '2': { key: 's3.mcstatic.com', doc_count: 10226447 },
  '3': { key: 's6.mcstatic.com', doc_count: 9724318 },
...
  '57': { key: 'revtest.mygraphs.com', doc_count: 1468 },
  '58': { key: 'www.metacafe.com:80', doc_count: 1316 },
  '59': { key: 'www.mbeans.com', doc_count: 1306 } }
```
After you decided what domains you need to get requests for, your command would be like this:
```bash
NODE_ENV=production node collect.js -v -i logstash-2015.10.15 -d res.mccont.com s1.mcstatic.com --min-count 500
```
That means: run query against _production_ ES cluster, collect requests from `logstash-2015.10.15` index, only for domains `res.mccont.com` and `s1.mcstatic.com`, consider only combinations with 500+ hits, save the result into `res.mccont.com.2.json` file. Default output file name consists of _first_ domain name and number of domains.

And you'll get something like the following for every domain name:
```bash
verbose: config:
{ domain: 'res.mccont.com',
  index: 'logstash-2015.10.15',
  verbose: true,
  file: 'res.mccont.com.2',
  minCount: 500,
  ........ }
info: 1st lvl aggregation started
info: 1st lvl done, XXX records, in NNN.NNs
verbose: second lvl query for: get:80/
verbose: second lvl query for: head:80/
....... (skipped a lot)
verbose:   completed 2nd lvl query for: head:80/assets/logo.png (1/1.97s)
verbose:   completed 2nd lvl query for: get:80/ (2/2.13s)
info: 2nd lvl done, YYYY records, in MMMM.MMs
```
Lines started with 'verbose' mark output only with __-v__ specified in the command line.
The result of the above command stored in the json file with the format:
```json
{
  "domain": "vl.mccont.com",
  "method": "get",
  "ipport": "80",
  "request": "/ItemFiles/%5BFrom%20www.metacafe.com%5D%209410446.24678844.4.mp4?__gda__=1443980028_82f115d343b6170fa44c730e7cf0532f&",
  "agent": "AppleCoreMedia/1.0.0.11D257 (iPad; U; CPU OS 7_1_2 like Mac OS X; en_us)",
  "referer": "",
  "count": 788
}, ...
```
#### Notes about implementation

__Methods__: Only `GET`, `HEAD`, and `POST` HTTP methods are now collected. It's hardcoded, not parameterized.

__2 level agg__: The lines about 1st and 2nd levels of aggregation cause by the fact that the aggregation is implemented in 2 levels: first one collects records for the same method, port and request string, second one aggregate agent string and referer for the _every_ record of the previout aggregation. Actually, the ES does the same, it's implemented such way with a hope to control memory consumption. 2nd level aggregation goes in parallel with concurrency == 4.

__depth_first__: important query parameter `collect_mode` is always equal `breadth_first` instead of default `depth_first`.
It's done to avoid ["baskets explosion"](https://www.elastic.co/guide/en/elasticsearch/guide/current/_preventing_combinatorial_explosions.html).


## Usage of `request_compare.js`

## Configuration

