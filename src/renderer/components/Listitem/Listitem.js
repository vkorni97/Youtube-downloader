import React, { Component } from 'react'
import ytdl from 'ytdl-core'
import fs from 'fs'
import './Listitem.css'
import Loading from './Loading'
import ProgressBar from './progressBar'
import {FaMicrophone, FaUser, FaArrowDown, FaWindowClose, FaPauseCircle} from 'react-icons/fa'
import ffmpegPath from 'ffmpeg-static-electron'
import ffmpeg from 'fluent-ffmpeg'

const isDevelopment = process.env.NODE_ENV !== 'production';
if (isDevelopment)
  ffmpeg.setFfmpegPath(ffmpegPath.path);
else
  ffmpeg.setFfmpegPath(ffmpegPath.path.replace("app.asar", "app.asar.unpacked"));

//TODO: MP3 selectable bitrate

export default class Listitem extends Component {
  constructor(props) {
    super(props);
    this.destroy = this.destroy.bind(this);
    this.mouseHover = this.mouseHover.bind(this);
    this.mouseLeave = this.mouseLeave.bind(this);
    this.doDownload = this.doDownload.bind(this);
    this.toHHMMSS = this.toHHMMSS.bind(this);
    this.chooseFormat = this.chooseFormat.bind(this);
    this.isLoading = this.isLoading.bind(this);
    this.state = {
      link: this.props.link,
      info: null,
      isHovering: false,
      isDownloading: false,
      percent: 0,
      time: 0,
      videoformats: [],
      selectedFormat: 'mp3',
    }
  }

  isLoading() { return this.state.info == null }
  chooseFormat(event) { this.setState({ selectedFormat: event.target.value }) }
  toHHMMSS(secs) {
    var sec_num = parseInt(secs, 10)    
    var hours   = Math.floor(sec_num / 3600) % 24
    var minutes = Math.floor(sec_num / 60) % 60
    var seconds = sec_num % 60    
    return [hours,minutes,seconds]
        .map(v => v < 10 ? "0" + v : v)
        .filter((v,i) => v !== "00" || i > 0)
        .join(":")
  }
  destroy() { this.props.unmountMe(this.props.index) }
  mouseHover() { if (!this.state.isHovering) this.setState({ isHovering: true }) }
  mouseLeave() { this.setState({ isHovering: false }) }
  doDownload() {
    if (this.state.info != null && !this.state.isDownloading) {
      var {selectedFormat} = this.state;
      this.setState({isDownloading: true});
      var path = this.props.options.path.split('\\');
      if (!fs.existsSync(path))
        for (var i = 0; i < path.length; i++) {
          var dir = path.slice(0, i+1).join('\\');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir)
        }
      path = path.join('\\') + '\\';
      var file = path + this.state.info.title.replace(/[*/'":<>?\\|]/g,'_');
      var options;
      if (selectedFormat !== "mp3") {
        options = {
          filter: (format) => format.quality_label === selectedFormat
        }
        ffmpeg(ytdl.downloadFromInfo(this.state.info, { quality: 'highest', filter: 'audio'})
        .on('progress', (length, downloaded, totallength) => {
          this.setState({ percent: Math.round(downloaded / totallength * 100) })
          console.log((downloaded / 1024 / 1024).toFixed(2) + " MB/" + (totallength / 1024 / 1024).toFixed(2) + " MB");
        }))
        .toFormat('mp3')
        .save(file+'_audio.mp3')
        .on('end', () => {
          ffmpeg()
            .input(ytdl.downloadFromInfo(this.state.info, options)
              .on('progress', (length, downloaded, totallength) => {
                this.setState({ percent: Math.round(downloaded / totallength * 100) })
              }))
            .videoCodec('copy')
            .input(file + "_audio.mp3")
            .audioCodec('copy')
            .save(file + ".mp4")
            .on('end', () => {
              fs.unlink(file + "_audio.mp3", err => {
                if(err) throw err;
              });
              this.destroy();
            });
        })
      }
      else {
        options = {
          quality: 'highest',
          filter: 'audio'
        }
        ffmpeg(ytdl.downloadFromInfo(this.state.info, options)
              .on('progress', (length, downloaded, totallength) => {
                this.setState({ percent: Math.round(downloaded / totallength * 100) })
              })
              .on('end', this.destroy))
        .toFormat('mp3')
        .audioBitrate('192')
        .save(file+'.mp3');
      }
    }
  }

  componentWillMount() {
    var {link} = this.state;
    ytdl.getInfo(link, (err, info) => {
      if (err) this.destroy();
      else {
        var allformats = ytdl.filterFormats(info.formats, "videoonly");
        var formats = [];
        allformats.forEach(format=> {
          if (!JSON.stringify(formats).includes(format.quality_label)) formats.push(format);
        })
        this.setState({ 
          info: info, 
          time: this.toHHMMSS(parseInt(info.length_seconds)), 
          videoformats: formats
        })
      }
    })
  }

  render() {
    var {info, isHovering, isDownloading, percent, time, videoformats} = this.state;
    var title, time;
    if (info != null) {
      title = info.title.split('-');
      if (title[1] != undefined) title[1] = title[1].trim();
    }
    return (
      <div className="container">
        {info == null ? (
          <Loading /> 
        ) : (
          <div onMouseOver={this.mouseHover} onMouseLeave={this.mouseLeave} className="item_container">
            <div className="img_container">
              {isHovering && <div onClick={this.destroy} className='close'><FaWindowClose/></div>}
              <img src={info.thumbnail_url} alt="img"/>
              <div className="img_time">{time}</div>
            </div>
            <div className="info">
              {title[1] != undefined && <div className="info_div"><FaMicrophone /><div>{title[1]}</div></div>}
              {title[1] != undefined && <br/>}
              <div className="info_div"><FaUser /><div>{title[0]}</div></div><br/>
              <div className="radio-group">
                <div>
                  <input type="radio" onClick={this.chooseFormat} value={"mp3"} name={`${this.props.index}type`} className="btnRadio" id={`${this.props.index}option`} defaultChecked />
                  <label htmlFor={`${this.props.index}option`}>MP3</label>
                </div>
                  {videoformats.map((format, i) => {
                    return (
                      <div key={i}>
                        <input type="radio" onClick={this.chooseFormat} value={format.quality_label} name={`${this.props.index}type`} className="btnRadio" id={`${this.props.index}option${i}`} />
                        <label htmlFor={`${this.props.index}option${i}`}>{format.quality_label}</label>
                      </div>
                    )
                  })}
              </div>
            </div>
            <div className="progressBar">
              <ProgressBar 
                strokeWidth="5"
                sqSize="45"
                percentage={percent}/>
            </div>
            <div className="btnIcon" onClick={this.doDownload}>
              { isDownloading ? <FaPauseCircle size={20}/> : <FaArrowDown size={20}/> }
            </div>
          </div>
        )}
      </div>
    )
  }
}