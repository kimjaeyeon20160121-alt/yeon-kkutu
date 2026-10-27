/* Yeon KKuTu Fool mode browser handler. Loaded after in_game_kkutu.min.js. */
(function () {
  if (typeof $lib === 'undefined') return;
  $lib.Fool = {
    roundReady: function(data) {
      clearBoard();
      $data._round = data.round;
      $data._roundTime = $data.room.time * 1000;
      $data._foolTime = $data._roundTime;
      $stage.game.display.text('바보모드 · 아무 글자나 입력하세요!');
      $stage.game.chain.show().text('0');
      drawRound(data.round);
      playSound('round_start');
      recordEvent('roundReady', {data:data});
    },
    turnStart: function(data) {
      if (!$data._spectate) {
        $stage.game.here.show();
        if (mobile) $stage.game.hereText.val('').focus();
        else $stage.talk.val('').focus();
      }
      ws.onmessage = _onMessage;
      clearInterval($data._tTime);
      clearTrespasses();
      $data._roundTime = data.roundTime;
      $data._tTime = addInterval(turnGoing, TICK);
      recordEvent('turnStart', {data:data});
    },
    turnGoing: function() {
      if (!$data.room) { clearInterval($data._tTime); return; }
      $data._roundTime = Math.max(0, $data._roundTime - TICK);
      $stage.game.roundBar.width(($data._roundTime / ($data.room.time * 1000) * 100) + '%')
        .text(($data._roundTime / 1000).toFixed(1) + '초');
    },
    turnEnd: function(id,data) {
      if (data.ok) {
        addScore(id, Number(data.score) || 0);
        var $uc = $('#game-user-' + id);
        drawObtainedScore($uc, $('<div>').addClass('deltaScore').text('+' + data.score));
        updateScore(id, getScore(id));
        $stage.game.display.text(data.value);
        if ($data.id === id) {
          $stage.game.chain.text((Number($stage.game.chain.text()) || 0) + 1);
          if (mobile) $stage.game.hereText.val('').focus();
          else $stage.talk.val('').focus();
        }
      } else {
        clearInterval($data._tTime);
        $stage.game.here.hide();
      }
    }
  };
})();
