doc['domain.raw'].value + ':' + doc['ipport'].value + doc['request.raw'].value + '::' + doc['method'].value + '::' + doc['agent.raw'].value + '::' + ( doc.containsKey('referer') ? doc['referer.raw'] : '' )
