var Lizard = require('../../sub/lizard');
exports.init = function() {};
exports.getTitle = function() {
  var tail = new Lizard.Tail();
  tail.go('①②③④⑤⑥⑦⑧⑨⑩');
  return tail;
};
exports.roundReady = function() {
  var my = this;
  clearTimeout(my.game.qTimer);
  clearTimeout(my.game._rrt);
  my.game.round++;
  my.game.roundTime = my.time * 1000;
  if (my.game.round > my.round) return my.roundEnd();
  my.byMaster('roundReady', {round:my.game.round, char:''}, true);
  my.game._rrt = setTimeout(my.turnStart, 2400);
};
exports.turnStart = function() {
  var my = this;
  my.game.late = false;
  clearTimeout(my.game.qTimer);
  my.game.qTimer = setTimeout(my.turnEnd, my.game.roundTime);
  my.byMaster('turnStart', {roundTime:my.game.roundTime, char:''}, true);
};
exports.turnEnd = function() {
  var my = this;
  if (my.game.late) return;
  my.game.late = true;
  clearTimeout(my.game.qTimer);
  my.byMaster('turnEnd', {ok:false, score:0}, true);
  my.game._rrt = setTimeout(my.roundReady, 3000);
};
exports.submit = function(client,text) {
  var my = this;
  if (!client.game || !my.gaming || my.game.late) return;
  if (typeof text !== 'string' || text.length === 0 || text.length > 100) return;
  var score = 10000;
  client.game.score += score;
  client.publish('turnEnd', {target:client.id,ok:true,value:text,score:score,bonus:0}, true);
};
exports.getScore = function() {return 10000;};
