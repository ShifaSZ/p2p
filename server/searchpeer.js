//file:searchpeer.js Author:shifa version 0.1
//const kbucket = require('k-bucket')
const Buffer = require('safe-buffer').Buffer

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
    this.closest_distance=0

    options.dpt._server.on('peersInfo', (peers) => {
      if (this.searching) {
        if (this.concurrents>0)
          this.concurrents += -1
        this.polls +=1;
        this._addSearching_list(peers)
        if (this.searching && this.polls>=this.max_polls
           && this.concurrents==0) {
          this.searching = false
          var dist = this.closest_distance
          var i
          for (i=0;i<512;i++) {
            if(dist < 1) break
            dist = dist/2
          }
          this.emit('found',{peer:null,distance:i})
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
    this.closest_distance = 256**id.length - 1
    const peersInfo = peers.map((peer) => {
      return ({id:peer.id,
       endpoint:{address: peer.address,
       tcpPort:peer.tcpPort,udpPort:peer.udpPort}})
    })
    this._addSearching_list(peersInfo)
    setTimeout(this._dec_concurr,2000)
    return true
  }

  _dec_concurr = () => {
    if (!this.searching)
      return;
    if (this.concurrents>0)
      this.concurrents += -1
    this._addSearching_list()
    setTimeout(this._dec_concurr,2000)
  }

  _addSearching_list = (peers) => {
    if (peers !== undefined && peers !== null)
    for(let peer of peers) {
      if (!Buffer.compare(peer.id,this.id)) {
        this.searching = false
        this.emit('found',{peer:peer,polls:this.polls})
        return
      }
      if (!this.searched_list.includes(peer.id) &&
        !this.searching_list.includes(peer))
        this.searching_list.push(peer)
    }
    while (this.searching_list.length>0 && this.searching && 
        this.concurrents<this.max_concurr &&
        this.polls < this.max_polls ) {
      const peer_closest = this._get_closest()
      //this.searching_list.pop(peer_closest.peer)
      this.searched_list.push(peer_closest.peer.id)
      this.concurrents +=1;
      //this.polls +=1;
      if (peer_closest.distance < this.closest_distance)
        this.closest_distance = peer_closest.distance
      this.findneighbours(peer_closest.peer.endpoint)
    }
  }

  _get_closest = () => {
    var distance=256**this.id.length-1;
    const len = this.searching_list.length
    var close_idx
    for (let i=0; i<len; i++ )
    {
      const distance1 = this._distance(this.searching_list[i].id,this.id);
      if (distance1<distance) {
        distance = distance1
        close_idx = i
      }
    }
    var closest_peer=this.searching_list[close_idx];
    this.searching_list[close_idx]=this.searching_list[len-1]
    this.searching_list.pop()
    //this.searching_list.slice(close_idx,1)
    return {peer:closest_peer,distance:distance};
  }


  _distance = function (firstId, secondId) {
  var distance = 0
  var min = Math.min(firstId.length, secondId.length)
  var max = Math.max(firstId.length, secondId.length)
  for (var i = 0; i < min; ++i) distance = distance * 256 + (firstId[i] ^ secondId[i])
  for (; i < max; ++i) distance = distance * 256 + 255
  return distance
  }
}

