//file:searchpeer.js Author:shifa version 0.1
//const kbucket = require('k-bucket')

const { EventEmitter } = require('events')

export class SearchPeer extends EventEmitter {
  constructor(options) {
    super()
    this.searching_list = []
    this.searched_list = []
    this.id = null
    this.searching = false
    this.concurrents = 0
    this.polls = 0
    this.max_concurr = options.max_concurrents
    this.max_polls = options.max_polls
    this.findneighbours = options.findneighbours

    options.dpt._server.on('peersInfo', (peers) => {
      if (this.searching) {
        if (this.concurrents>0)
          this.concurrents += -1
        this._addSearching_list(peers)
        if (this.searching && this.polls>=this.max_polls
           && this.concurrents==0) {
          this.searching = false
          this.emit('found',null)
        }
      }
    })
  }

  // Param: id: The id to be searched
  // peers: the local closest peers
  // return: false: failed because previous searding is working
  // true: start searching successfully
  StartSearching=(id, peers)=> {
    if (this.searching)
      return false
    this.searching_list = []
    this.searched_list = []
    this.id = id
    this.concurrents = 0
    this.polls = 0
    this.searching = true
    const peersInfo = peers.map((peer) => {
      return ({id:peer.id,
       endpoint:{address: peer.address,
       tcpPort:peer.tcpPort,udpPort:peer.udpPort}})
    })
    this._addSearching_list(peersInfo)
    setTimeout(this._dec_concurr,10000)
    return true
  }

  _dec_concurr = () => {
    if (!this.searching)
      return;
    if (this.concurrents>0)
      this.concurrents += -1
    this._addSearching_list()
    setTimeout(this._dec_concurr,10000)
  }

  _addSearching_list = (peers) => {
    if (peers !== undefined && peers !== null)
    for(let peer of peers) {
      if (peer.id === this.id) {
        this.searching = false
        this.emit('found',peer)
        return
      }
      if (!this.searched_list.includes(peer.id) &&
        !this.searching_list.includes(peer))
        this.searching_list.push(peer)
    }
    while (this.searching_list.length>0 && this.searching && 
        this.concurrents<this.max_concurr &&
        this.polls < this.max_polls ) {
      const peer_closest = SearchPeer.find_closest(this.searching_list,this.id)
      this.searching_list.pop(peer_closest)
      this.searched_list.push(peer_closest.id)
      this.concurrents +=1;
      this.polls +=1;
      this.findneighbours(peer_closest.endpoint)
    }
  }
}

SearchPeer.find_closest = function(list, id){
  var distance=256**id.length-1;
  var closest_peer=null;
  for (let peer of list)
  {
    const distance1 = SearchPeer.distance(peer.id,id);
    if (distance1<distance) {
      distance = distance1;
      closest_peer = peer;
    }
  }
  return closest_peer;
}


SearchPeer.distance = function (firstId, secondId) {
  var distance = 0
  var min = Math.min(firstId.length, secondId.length)
  var max = Math.max(firstId.length, secondId.length)
  for (var i = 0; i < min; ++i) distance = distance * 256 + (firstId[i] ^ secondId[i])
  for (; i < max; ++i) distance = distance * 256 + 255
  return distance
}

